from sqlalchemy.orm import Session

from app.models.models import Version, CRStatus, Deployment, DeploymentEnvironment, DeploymentStatus


def evaluate_release_readiness(db: Session, version: Version) -> dict:
    checks = []

    crs = version.change_requests
    all_approved = all(cr.status in (CRStatus.APPROVED.value, CRStatus.COMPLETED.value) for cr in crs) if crs else True
    checks.append({
        "label": "All change requests approved",
        "passed": all_approved,
        "detail": "" if all_approved else "One or more linked change requests are not yet approved",
    })

    required_completed = all(cr.status == CRStatus.COMPLETED.value for cr in crs) if crs else True
    checks.append({
        "label": "Required changes completed",
        "passed": required_completed,
        "detail": "" if required_completed else "One or more linked change requests are not yet completed",
    })

    checks.append({
        "label": "Baseline available",
        "passed": len(version.project.baselines) > 0,
        "detail": "" if version.project.baselines else "No baseline exists for this project",
    })

    linked_pr_count = sum(1 for cr in crs if cr.github_pr_number)
    prs_merged = all((cr.github_pr_state or "").lower() == "merged" for cr in crs if cr.github_pr_number)
    prs_check = prs_merged if linked_pr_count else True
    checks.append({
        "label": "Linked GitHub PRs merged",
        "passed": prs_check,
        "detail": "" if prs_check else "One or more linked GitHub pull requests are not merged yet",
    })

    checks.append({
        "label": "Testing completed",
        "passed": version.testing_completed,
        "detail": "" if version.testing_completed else "Testing has not been marked complete",
    })

    checks.append({
        "label": "UAT completed",
        "passed": version.uat_completed,
        "detail": "" if version.uat_completed else "UAT has not been marked complete",
    })

    blockers = [c["label"] + (": " + c["detail"] if c["detail"] else "") for c in checks if not c["passed"]]
    ready = len(blockers) == 0

    return {
        "version_id": version.id,
        "version_number": version.version_number,
        "checks": checks,
        "ready": ready,
        "blockers": blockers,
    }
