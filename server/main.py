import json
import logging
import shutil
import tempfile
import uuid
from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from typing import Annotated

import webvtt
from celery.result import AsyncResult
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr

import authentication as auth
import database as db
import tasks
from config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    API_PREFIX,
    EXPORT_DIR,
    MIN_KEY_LENGTH,
    ORIGINS,
    SCREENSHOT_UPLOAD_DIR,
    SECRET_KEY,
    SUBTITLE_UPLOAD_DIR,
    VIDEO_UPLOAD_DIR,
    get_path,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    get_path(VIDEO_UPLOAD_DIR).mkdir(exist_ok=True, parents=True)
    get_path(SUBTITLE_UPLOAD_DIR).mkdir(exist_ok=True)
    get_path(SCREENSHOT_UPLOAD_DIR).mkdir(exist_ok=True)
    get_path(EXPORT_DIR).mkdir(exist_ok=True)
    app.mount(
        API_PREFIX + 'uploads',
        StaticFiles(directory=get_path('uploads')),
        name='uploads'
    )
    db.create_db_and_tables()
    if len(SECRET_KEY) < MIN_KEY_LENGTH:
        logger.warning('Secret key not set. Using insecure default')

    yield


app = FastAPI(title='vian-server', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)



class UserInfo(BaseModel):
    email: EmailStr
    password: str


class StoreData(BaseModel):
    name: str
    id: str|None
    data: dict


class LoadStore(BaseModel):
    name: str
    id: str|None


class VideoInfo(BaseModel):
    video: str
    id: str


class ScreenshotInfo(BaseModel):
    video: str
    frames: list[int]
    id: str


class ScreenshotExport(BaseModel):
    frames: list[int]|None
    id: str


class ProjectExport(BaseModel):
    id: str


@app.post(API_PREFIX + 'signup')
async def signup(user: UserInfo, session: db.SessionDep) -> dict:
    if db.get_account_by_email(session, user.email):
        raise HTTPException(status_code=400, detail='Email already registered')

    hashed_password = auth.get_password_hash(user.password)

    db.create_account(session, user.email, hashed_password)
    return {'message': 'User created successfully'}


@app.post(API_PREFIX + 'login')
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]) -> dict:
    user_email = form_data.username
    user_password = form_data.password

    with next(db.get_session()) as session:
        if ((user := db.get_account_by_email(session, user_email)) is None
        or not auth.verify_password(user_password, user.password)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Incorrect username or password',
                headers={'WWW-Authenticate': 'Bearer'},
            )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={'sub': user_email}, expires_delta=access_token_expires
    )
    return {'access_token': access_token, 'token_type': 'bearer'}


@app.get(API_PREFIX + 'renew-token')
async def renew_token(current_account: auth.AccountDep, session: db.SessionDep) -> dict:
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={'sub': current_account.email}, expires_delta=access_token_expires
    )
    return {'access_token': access_token, 'token_type': 'bearer'}


@app.post(API_PREFIX + 'save-store')
async def save_store(
    store: StoreData,
    current_account: auth.AccountDep,
    session: db.SessionDep
) -> dict:
    db.save_store(session, current_account, store.name, store.id, store.data)

    return {'message': f'Store "{store.name}" saved successfully'}


@app.post(API_PREFIX + 'load-store')
async def load_store(
    store: LoadStore,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    dbstore = db.load_store(session, current_account, store.name, store.id)
    if dbstore:
        return json.loads(dbstore.data)
    raise HTTPException(status_code=404, detail=f'Store "{store.name}" not found')


@app.post(API_PREFIX + 'upload-video')
async def upload_video(
    session: db.SessionDep,
    current_account: auth.AccountDep,
    file: Annotated[UploadFile, File(...)],
) -> dict:
    if file.content_type not in ('video/mp4', 'video/quicktime'):  # type: ignore
        raise HTTPException(
            status_code=400,
            detail='Invalid file type. Please upload a mp4 or mov video.'
        )

    unique_filename = f'{uuid.uuid4()}.mp4'
    full_file_path = get_path(VIDEO_UPLOAD_DIR) / unique_filename

    try:
        with full_file_path.open('wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f'Error uploading video: {e!s}'
        ) from e

    return {
        'location': API_PREFIX + str(VIDEO_UPLOAD_DIR / unique_filename),
        'name': file.filename
    }


@app.post(API_PREFIX + 'get-video-info')
async def get_video_info(
    videoinfo: VideoInfo,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    video_path = get_path(VIDEO_UPLOAD_DIR) / videoinfo.video.rsplit('/')[-1]
    job = db.create_job(session, current_account, 'video-info', videoinfo.id)
    worker = tasks.get_video_info.delay(str(video_path), job.id)  # type: ignore
    db.update_job(session, job.id, worker=worker.id)
    return {'message': 'job submitted'}


@app.post(API_PREFIX + 'shotboundary-detection')
async def shotboundary_detection(
    videoinfo: VideoInfo,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    video_path = get_path(VIDEO_UPLOAD_DIR) / videoinfo.video.rsplit('/')[-1]
    job = db.create_job(
        session,
        current_account,
        'shotboundary-detection',
        videoinfo.id
    )
    worker = tasks.shotboundary_detection.delay(str(video_path), job.id)  # type: ignore
    db.update_job(session, job.id, worker=worker.id)
    return {'message': 'job submitted'}


@app.post(API_PREFIX + 'screenshots-generation')
async def screenshots_generation(
    screenshotinfo: ScreenshotInfo,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    video = screenshotinfo.video.rsplit('/')[-1]
    video_path = get_path(VIDEO_UPLOAD_DIR) / video
    screenshots_path = SCREENSHOT_UPLOAD_DIR / screenshotinfo.id
    get_path(screenshots_path).mkdir(exist_ok=True)

    if len(screenshotinfo.frames) == 1:
        job = db.create_job(
            session,
            current_account,
            'screenshot-generation',
            screenshotinfo.id
        )
        worker = tasks.screenshot_generation.delay(  # type: ignore
            str(video_path),
            str(screenshots_path),
            screenshotinfo.frames[0],
            job.id
        )
    else:
        job = db.create_job(
            session,
            current_account,
            'screenshots-generation',
            screenshotinfo.id
        )
        worker = tasks.screenshots_generation.delay(  # type: ignore
            str(video_path),
            str(screenshots_path),
            screenshotinfo.frames,
            job.id
        )
    db.update_job(session, job.id, worker=worker.id)

    return {'message': 'job submitted'}


@app.get(API_PREFIX + 'get-jobs/{projectid}')
async def get_jobs(
    projectid: str,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> Sequence:
    return db.get_jobs(session, current_account, projectid)


@app.get(API_PREFIX + 'get-jobs/')
async def get_jobs_all(
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> Sequence:
    return  db.get_jobs(session, current_account, None)


@app.get(API_PREFIX + 'get-result/{jobid}')
async def get_result(
    jobid: int,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> db.Result|None:
    return db.get_result(session, current_account, jobid)


@app.post(API_PREFIX + 'upload-subtitles/{projectid}')
async def upload_subtitles(
    projectid: str,
    session: db.SessionDep,
    current_account: auth.AccountDep,
    file: Annotated[UploadFile, File(...)],
) -> dict:
    if not file.content_type.startswith('application/x-subrip'):  # type: ignore
        raise HTTPException(
            status_code=400,
            detail='Invalid file type. Please upload a srt subtitle.'
        )

    unique_filename = f'{uuid.uuid4()}.srt'
    full_file_path = get_path(SUBTITLE_UPLOAD_DIR) / unique_filename
    vtt_file_path = str(full_file_path).replace('srt', 'vtt')

    try:
        with full_file_path.open('wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f'Error uploading video: {e!s}'
        ) from e

    webvtt.from_srt(str(full_file_path)).save(vtt_file_path)
    full_file_path.unlink()

    unique_filename = unique_filename.replace('srt', 'vtt')

    return {
        'location': API_PREFIX +
                    str(SUBTITLE_UPLOAD_DIR / unique_filename)
    }


@app.get(API_PREFIX + 'terminate-job/{task_id}')
async def terminate_job(
    task_id: int,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    job = db.get_job(session, current_account, task_id)
    if not job:
        return {'message': 'Job not found'}

    task = AsyncResult(job.worker)
    if task.state in ('PENDING', 'STARTED'):
        task.revoke(terminate=True, signal='SIGTERM')
        db.update_job(session, job.id, status='CANCELED')
        return {'message': 'Terminated'}
    return {'message': 'Job not running'}


# TODO: bulk-cancel endpoint for the web build's leave-project warning
# (see [id].vue leaveProject()). Not implemented yet; the Electron build
# terminates each running job individually via terminate-job instead.
@app.get(API_PREFIX + 'cancel-project-jobs/{projectid}')
async def cancel_project_jobs(
    projectid: str,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    raise HTTPException(status_code=501, detail='Not implemented')


@app.post(API_PREFIX + 'export-screenshots')
async def export_screenshots(
    export: ScreenshotExport,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    job = db.create_job(session, current_account, 'export-screenshots', export.id)
    undoable_store = db.load_store(session, current_account, 'undoable', export.id)
    main_store = db.load_store(session, current_account, 'main', export.id)
    if undoable_store is None or main_store is None:
        return {'message': 'Store not found'}
    undoable_store = json.loads(undoable_store.data)
    main_store = json.loads(main_store.data)
    worker = tasks.export_screenshots.delay(  # type: ignore
        undoable_store['timelines'],
        export.frames,
        main_store['fps'],
        undoable_store['id'],
        job.id
    )
    db.update_job(session, job.id, worker=worker.id)
    return {'message': 'job submitted'}


@app.post(API_PREFIX + 'export-project')
async def export_project(
    export: ProjectExport,
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    job = db.create_job(session, current_account, 'export-project', export.id)
    worker = tasks.export_project.delay(  # type: ignore
        export.id,
        job.id
    )
    db.update_job(session, job.id, worker=worker.id)
    return {'message': 'job submitted'}


@app.post(API_PREFIX + 'import-project')
async def import_project(
    video: Annotated[UploadFile, File(...)],
    zipfile: Annotated[UploadFile, File(...)],
    session: db.SessionDep,
    current_account: auth.AccountDep
) -> dict:
    if video.content_type not in ('video/mp4', 'video/quicktime'):  # type: ignore
        raise HTTPException(
            status_code=400,
            detail='Invalid file type. Please upload a video file.'
        )
    if not zipfile.content_type.startswith('application/zip'):  # type: ignore
        raise HTTPException(
            status_code=400,
            detail='Invalid file type. Please upload a zip file.'
        )

    tmp = tempfile.mkdtemp()
    videoTmpPath = Path(tmp) / (video.filename or 'video.mp4')
    with videoTmpPath.open('wb') as buffer:
        shutil.copyfileobj(video.file, buffer)
    zipTmpPath = Path(tmp) / (zipfile.filename or 'file.zip')
    with zipTmpPath.open('wb') as buffer:
        shutil.copyfileobj(zipfile.file, buffer)

    project_id = str(uuid.uuid4())
    job = db.create_job(session, current_account, 'import-project', project_id)
    worker = tasks.import_project.delay(  # type:ignore
        str(videoTmpPath),
        str(zipTmpPath),
        project_id,
        job.id
    )
    db.update_job(session, job.id, worker=worker.id)
    return {'message': 'job submitted'}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='localhost', port=8000, log_level='info')
