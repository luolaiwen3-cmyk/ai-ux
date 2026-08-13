"""Create core tables."""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("tasks", sa.Column("id", sa.String(36), primary_key=True), sa.Column("name", sa.String(200), nullable=False), sa.Column("scenario", sa.String(80), nullable=False), sa.Column("public_token", sa.String(64), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_tasks_public_token", "tasks", ["public_token"], unique=True)
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_table("sessions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("task_id", sa.String(36), sa.ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False), sa.Column("participant_id", sa.String(40), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("duration_ms", sa.Integer(), nullable=False), sa.Column("stop_reason", sa.String(30)), sa.Column("event_count", sa.Integer(), nullable=False), sa.Column("face_frame_count", sa.Integer(), nullable=False), sa.Column("severity", sa.String(10)), sa.Column("issue_summary", sa.String(500)))
    op.create_index("ix_sessions_task_id", "sessions", ["task_id"])
    op.create_index("ix_sessions_status", "sessions", ["status"])
    op.create_table("upload_batches", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False), sa.Column("stream", sa.String(20), nullable=False), sa.Column("sequence", sa.Integer(), nullable=False), sa.Column("record_count", sa.Integer(), nullable=False), sa.Column("checksum", sa.String(64), nullable=False), sa.Column("file_path", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("session_id", "stream", "sequence", name="uq_batch_sequence"))
    op.create_index("ix_upload_batches_session_id", "upload_batches", ["session_id"])
    op.create_table("reports", sa.Column("session_id", sa.String(36), sa.ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True), sa.Column("content", sa.JSON(), nullable=False), sa.Column("source", sa.String(30), nullable=False), sa.Column("version", sa.Integer(), nullable=False), sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False))


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("upload_batches")
    op.drop_table("sessions")
    op.drop_table("tasks")
