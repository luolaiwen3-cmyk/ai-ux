"""Add per-session upload token hash."""
from alembic import op
import sqlalchemy as sa

revision = "0002_session_upload_token"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.add_column(sa.Column("upload_token_hash", sa.String(64), nullable=True))
    op.execute("UPDATE sessions SET upload_token_hash = '' WHERE upload_token_hash IS NULL")
    with op.batch_alter_table("sessions") as batch:
        batch.alter_column("upload_token_hash", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("sessions") as batch:
        batch.drop_column("upload_token_hash")
