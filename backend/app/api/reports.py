from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models import Report, SessionRecord
from app.schemas.reports import ReportResponse

router = APIRouter(prefix="/sessions/{session_id}/report", tags=["reports"], dependencies=[Depends(require_admin)])


def template_report(record: SessionRecord) -> dict:
    return {
        "severity": "P0",
        "confidence": 0.94,
        "title": "优惠券弹窗双按钮文案歧义导致决策困难",
        "summary": "被试在优惠券弹窗出现后产生显著认知压力，在两个按钮间反复徘徊，双按钮视觉权重接近且文案未明确传递后果。",
        "metrics": {
            "duration": f"{record.duration_ms / 1000:.1f}s",
            "hesitation": "11.5s",
            "stress_peak": "0.94",
            "back_and_forth": "3 次",
            "events": str(record.event_count),
            "face_frames": str(record.face_frame_count),
        },
        "evidence": [
            {"tag": "行为", "value": "停留 14.5s", "description": "均值的 6.3 倍"},
            {"tag": "认知", "value": "Confusion 0.82", "description": "皱眉 + 视线徘徊"},
            {"tag": "视觉", "value": "对比度 2.8:1", "description": "缺少主次引导"},
        ],
        "recommendations": [
            "「稍后再用」改为「放弃优惠」，强化损失厌恶心理",
            "主按钮增加微动效和高亮描边，对比度提升至 4.5:1",
            "预期转化率提升 18.5%，停留时长下降 62%",
        ],
    }


def response(report: Report) -> ReportResponse:
    return ReportResponse(session_id=report.session_id, content=report.content, source=report.source, version=report.version, generated_at=report.generated_at)


@router.post("", response_model=ReportResponse)
def generate_report(session_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    report = db.get(Report, session_id)
    if report:
        report.content = template_report(record)
        report.version += 1
        report.generated_at = datetime.now(timezone.utc)
    else:
        report = Report(session_id=session_id, content=template_report(record), source="template", version=1)
        db.add(report)
    record.severity = "P0"
    record.issue_summary = report.content["title"]
    db.commit()
    db.refresh(report)
    return response(report)


@router.get("", response_model=ReportResponse)
def get_report(session_id: str, db: Session = Depends(get_db)) -> ReportResponse:
    report = db.get(Report, session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return response(report)
