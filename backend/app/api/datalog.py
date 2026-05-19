from __future__ import annotations
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from app.datalog.disk_store import DatalogDiskStore
from app.models.datalog_model import DatalogUploadResponse
from app.parsers.datalog_parser import parse_datalog

router = APIRouter(prefix="/api/datalog", tags=["datalog"])


def get_store() -> DatalogDiskStore:
    return DatalogDiskStore()


@router.post("/upload", response_model=DatalogUploadResponse)
async def upload_datalog(
    file:            UploadFile = File(...),
    x_content_hash:  str | None = Header(default=None, alias="X-Content-Hash"),
    store:           DatalogDiskStore = Depends(get_store),
):
    if not x_content_hash or ":" not in x_content_hash:
        raise HTTPException(
            status_code=400,
            detail="Header X-Content-Hash ausente ou malformado. Formato esperado: 'sha1:<hexdigest>'",
        )

    hash_str = x_content_hash.strip()

    # Cache hit
    if store.exists(hash_str):
        store.touch(hash_str)
        model = store.get(hash_str)
        return DatalogUploadResponse(**model.model_dump(), cached=True)

    # Cache miss — parse
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Arquivo vazio.")

    try:
        model = parse_datalog(content, file.filename or "datalog.csv", hash_str)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    store.save(hash_str, model)
    return DatalogUploadResponse(**model.model_dump(), cached=False)
