"""Seed the database with sample data matching the MedRelease demo dataset.

Run with:  python -m app.seed
Safe to re-run: it checks for existing data before inserting.
"""
from datetime import datetime, timedelta, timezone

from app.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.models import (
    User,
    Organization,
    OrganizationMembership,
    Project,
    ConfigurationItem,
    Baseline,
    BaselineItem,
    ChangeRequest,
    Version,
    Deployment,
    GitHubConnection,
)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("[seed] Data already present, skipping seed.")
            return

        print("[seed] Seeding MedRelease sample data...")

        # ---------------- Users ----------------
        admin = User(email="admin@medrelease.com", full_name="System Admin", is_admin=True,
                     hashed_password=hash_password("Password123!"))
        mgr_medicare = User(email="manager@medicare.com", full_name="Maria Reyes",
                            hashed_password=hash_password("Password123!"))
        dev_medicare = User(email="developer@medicare.com", full_name="Devon Cruz",
                            hashed_password=hash_password("Password123!"))
        mgr_citycare = User(email="manager@citycare.com", full_name="Carlos Nunez",
                            hashed_password=hash_password("Password123!"))
        dev_citycare = User(email="developer@citycare.com", full_name="Casey Nguyen",
                            hashed_password=hash_password("Password123!"))
        db.add_all([admin, mgr_medicare, dev_medicare, mgr_citycare, dev_citycare])
        db.flush()

        # ---------------- Organizations ----------------
        medicare = Organization(name="MediCare Hospital", description="Leading healthcare provider", status="ACTIVE")
        citycare = Organization(name="CityCare Hospital", description="Urban healthcare network", status="ACTIVE")
        db.add_all([medicare, citycare])
        db.flush()

        db.add_all([
            OrganizationMembership(user_id=mgr_medicare.id, organization_id=medicare.id, role="MANAGER"),
            OrganizationMembership(user_id=dev_medicare.id, organization_id=medicare.id, role="DEVELOPER"),
            OrganizationMembership(user_id=mgr_citycare.id, organization_id=citycare.id, role="MANAGER"),
            OrganizationMembership(user_id=dev_citycare.id, organization_id=citycare.id, role="DEVELOPER"),
        ])
        db.flush()

        # ---------------- Projects ----------------
        medicare_hms = Project(organization_id=medicare.id, name="Hospital Management System", description="Complete HMS", status="ACTIVE")
        medicare_portal = Project(organization_id=medicare.id, name="Patient Portal", description="Patient self-service portal", status="ACTIVE")
        citycare_hms = Project(organization_id=citycare.id, name="Hospital Management System", description="Complete HMS", status="ACTIVE")
        citycare_emergency = Project(organization_id=citycare.id, name="Emergency Module", description="Emergency response system", status="PLANNING")
        db.add_all([medicare_hms, medicare_portal, citycare_hms, citycare_emergency])
        db.flush()

        # ---------------- Configuration Items ----------------
        patient_registration = ConfigurationItem(project_id=medicare_hms.id, name="Patient Registration", status="ACTIVE", version="1.2")
        laboratory = ConfigurationItem(project_id=medicare_hms.id, name="Laboratory", status="ACTIVE", version="1.4")
        pharmacy = ConfigurationItem(project_id=medicare_hms.id, name="Pharmacy", status="ACTIVE", version="1.1")
        billing = ConfigurationItem(project_id=medicare_hms.id, name="Billing", status="ACTIVE", version="1.0")
        appointment_mgmt = ConfigurationItem(project_id=medicare_hms.id, name="Appointment Management", status="ACTIVE", version="1.3")
        doctor_dashboard = ConfigurationItem(project_id=medicare_hms.id, name="Doctor Dashboard", status="ACTIVE", version="1.0")
        report_service = ConfigurationItem(project_id=medicare_hms.id, name="Report Service", status="ACTIVE", version="1.0")
        prescription_module = ConfigurationItem(project_id=medicare_hms.id, name="Prescription Module", status="ACTIVE", version="1.0")
        insurance_module = ConfigurationItem(project_id=medicare_hms.id, name="Insurance Module", status="ACTIVE", version="1.0")

        appointment_booking = ConfigurationItem(project_id=medicare_portal.id, name="Appointment Booking", status="ACTIVE", version="1.0")
        test_results_view = ConfigurationItem(project_id=medicare_portal.id, name="Test Results View", status="ACTIVE", version="1.0")

        emergency_module_ci = ConfigurationItem(project_id=citycare_hms.id, name="Emergency Module", status="PLANNING", version="0.9")
        cc_doctor_dashboard = ConfigurationItem(project_id=citycare_hms.id, name="Doctor Dashboard", status="ACTIVE", version="1.0")
        cc_laboratory = ConfigurationItem(project_id=citycare_hms.id, name="Laboratory", status="ACTIVE", version="1.0")
        cc_pharmacy = ConfigurationItem(project_id=citycare_hms.id, name="Pharmacy", status="ACTIVE", version="1.0")
        cc_reporting = ConfigurationItem(project_id=citycare_hms.id, name="Reporting", status="ACTIVE", version="1.0")

        db.add_all([
            patient_registration, laboratory, pharmacy, billing, appointment_mgmt, doctor_dashboard,
            report_service, prescription_module, insurance_module, appointment_booking, test_results_view,
            emergency_module_ci, cc_doctor_dashboard, cc_laboratory, cc_pharmacy, cc_reporting,
        ])
        db.flush()

        # Dependencies: `X.dependencies.append(Y)` means X depends on Y
        laboratory.dependencies.append(report_service)
        report_service.dependencies.append(doctor_dashboard)
        pharmacy.dependencies.append(prescription_module)
        billing.dependencies.append(insurance_module)
        appointment_mgmt.dependencies.append(patient_registration)
        db.flush()

        # ---------------- Baselines ----------------
        bl_20 = Baseline(project_id=medicare_hms.id, name="BL-2.0", description="Approved config before v2.1", status="APPROVED")
        bl_10 = Baseline(project_id=citycare_hms.id, name="BL-1.0", description="Initial baseline", status="APPROVED")
        db.add_all([bl_20, bl_10])
        db.flush()

        for ci in [patient_registration, laboratory, pharmacy, billing, appointment_mgmt, doctor_dashboard]:
            db.add(BaselineItem(baseline_id=bl_20.id, configuration_item_id=ci.id, version_snapshot="1.0"))
        for ci in [emergency_module_ci, cc_doctor_dashboard, cc_laboratory]:
            db.add(BaselineItem(baseline_id=bl_10.id, configuration_item_id=ci.id, version_snapshot="1.0"))
        db.flush()

        # ---------------- Change Requests ----------------
        cr1 = ChangeRequest(
            code="CR-001", project_id=medicare_hms.id, configuration_item_id=laboratory.id,
            title="Fix Laboratory Report Download", description="Lab report PDF download times out for large reports.",
            priority="CRITICAL", status="COMPLETED", requested_by_id=dev_medicare.id,
            github_pr_number=42, github_pr_url="https://github.com/medrelease-demo/hospital-management-system/pull/42",
            github_pr_state="merged",
        )
        cr2 = ChangeRequest(
            code="CR-002", project_id=medicare_hms.id, configuration_item_id=appointment_mgmt.id,
            title="Update Appointment Validation", description="Prevent double-booking of the same slot.",
            priority="HIGH", status="APPROVED", requested_by_id=dev_medicare.id,
            github_pr_number=45, github_pr_url="https://github.com/medrelease-demo/hospital-management-system/pull/45",
            github_pr_state="open",
        )
        cr3 = ChangeRequest(
            code="CR-003", project_id=medicare_hms.id, configuration_item_id=laboratory.id,
            title="Add New Lab Tests", description="Support additional lab test types requested by clinicians.",
            priority="MEDIUM", status="IN_PROGRESS", requested_by_id=dev_medicare.id,
            github_pr_number=47, github_pr_url="https://github.com/medrelease-demo/hospital-management-system/pull/47",
            github_pr_state="open",
        )
        db.add_all([cr1, cr2, cr3])
        db.flush()

        # Approval on CR-001 by manager
        from app.models.models import Approval
        db.add(Approval(change_request_id=cr1.id, approver_id=mgr_medicare.id, decision="APPROVED", comments="Looks good, ship it."))
        db.add(Approval(change_request_id=cr2.id, approver_id=mgr_medicare.id, decision="APPROVED", comments="Approved for next release."))
        db.flush()

        # ---------------- Versions ----------------
        v231 = Version(
            project_id=medicare_hms.id, version_number="2.3.1", description="Hotfix for lab reports",
            status="RELEASED", testing_completed=True, uat_completed=True,
            github_release_tag="v2.3.1", github_release_name="Hotfix for lab reports",
            github_release_url="https://github.com/medrelease-demo/hospital-management-system/releases/tag/v2.3.1",
        )
        v240 = Version(
            project_id=medicare_hms.id, version_number="2.4.0", description="UAT in progress",
            status="UAT", testing_completed=True, uat_completed=False,
        )
        db.add_all([v231, v240])
        db.flush()

        v231.change_requests.append(cr1)
        v240.change_requests.append(cr2)
        v240.change_requests.append(cr3)
        db.flush()

        # ---------------- Deployments ----------------
        base_day = datetime(2026, 1, 20, tzinfo=timezone.utc)
        db.add_all([
            Deployment(version_id=v231.id, environment="DEVELOPMENT", status="COMPLETED", deployed_at=base_day),
            Deployment(version_id=v231.id, environment="TESTING", status="COMPLETED", deployed_at=base_day + timedelta(days=1)),
            Deployment(version_id=v231.id, environment="UAT", status="COMPLETED", deployed_at=base_day + timedelta(days=2)),
            Deployment(version_id=v231.id, environment="PRODUCTION", status="COMPLETED", deployed_at=base_day + timedelta(days=3)),
            Deployment(version_id=v240.id, environment="DEVELOPMENT", status="COMPLETED", deployed_at=base_day + timedelta(days=10)),
            Deployment(version_id=v240.id, environment="TESTING", status="COMPLETED", deployed_at=base_day + timedelta(days=11)),
            Deployment(version_id=v240.id, environment="UAT", status="IN_PROGRESS"),
        ])

        # ---------------- GitHub connections (demo mode) ----------------
        db.add(GitHubConnection(project_id=medicare_hms.id, repo_owner="medrelease-demo", repo_name="hospital-management-system", mode="demo"))
        db.add(GitHubConnection(project_id=citycare_hms.id, repo_owner="medrelease-demo", repo_name="citycare-hms", mode="demo"))

        db.commit()
        print("[seed] Done. Sample accounts (password for all: Password123!):")
        print("  admin@medrelease.com     (ADMIN, all organizations)")
        print("  manager@medicare.com     (MANAGER, MediCare Hospital)")
        print("  developer@medicare.com   (DEVELOPER, MediCare Hospital)")
        print("  manager@citycare.com     (MANAGER, CityCare Hospital)")
        print("  developer@citycare.com   (DEVELOPER, CityCare Hospital)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
