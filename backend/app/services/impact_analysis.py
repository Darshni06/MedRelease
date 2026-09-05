from sqlalchemy.orm import Session

from app.models.models import ConfigurationItem, ChangeRequest


def analyze_impact(db: Session, ci: ConfigurationItem) -> dict:
    direct = [{"id": d.id, "name": d.name, "status": d.status} for d in ci.dependencies]

    # potentially affected = things that depend on this CI, directly or transitively (2 hops)
    seen: set[int] = {ci.id}
    affected = []
    frontier = list(ci.dependents)
    depth = 0
    while frontier and depth < 3:
        next_frontier = []
        for node in frontier:
            if node.id in seen:
                continue
            seen.add(node.id)
            affected.append({"id": node.id, "name": node.name, "status": node.status})
            next_frontier.extend(node.dependents)
        frontier = next_frontier
        depth += 1

    related_crs = (
        db.query(ChangeRequest)
        .filter(ChangeRequest.configuration_item_id.in_(list(seen) + [d.id for d in ci.dependencies]))
        .order_by(ChangeRequest.created_at.desc())
        .limit(10)
        .all()
    )
    related = [
        {"id": cr.id, "code": cr.code, "title": cr.title, "status": cr.status}
        for cr in related_crs
    ]

    baseline = None
    project = ci.project
    approved_baselines = [b for b in project.baselines if b.status == "APPROVED"]
    if approved_baselines:
        latest = sorted(approved_baselines, key=lambda b: b.created_at, reverse=True)[0]
        baseline = {"id": latest.id, "name": latest.name, "status": latest.status}

    return {
        "configuration_item_id": ci.id,
        "configuration_item_name": ci.name,
        "direct_dependencies": direct,
        "potentially_affected": affected,
        "related_change_requests": related,
        "current_baseline": baseline,
    }
