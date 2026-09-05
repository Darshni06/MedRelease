from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.models import Project, ConfigurationItem, User
from app.schemas.schemas import DependencyGraphResponse, GraphNode, GraphEdge
from app.services.rbac import require_org_access

router = APIRouter()


@router.get("/{project_id}", response_model=DependencyGraphResponse)
def get_dependency_graph(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    require_org_access(db, user, project.organization_id)

    cis = db.query(ConfigurationItem).filter(ConfigurationItem.project_id == project_id).all()
    nodes = [GraphNode(id=ci.id, label=ci.name, status=ci.status) for ci in cis]
    edges = []
    for ci in cis:
        for dep in ci.dependencies:
            edges.append(GraphEdge(source=ci.id, target=dep.id))

    return DependencyGraphResponse(nodes=nodes, edges=edges)
