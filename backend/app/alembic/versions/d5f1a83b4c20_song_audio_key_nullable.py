"""audio_file_key становится необязательным

Песня, играющая по ссылке с ютуба, не имеет файла в хранилище. Такая
запись нужна ради связей — лайков и плейлистов, — а не ради аудио.
До этого добавить ютуб-трек в плейлист было нельзя в принципе.

Revision ID: d5f1a83b4c20
Revises: c1d4e7a90b22
"""
from alembic import op
import sqlalchemy as sa

revision = 'd5f1a83b4c20'
down_revision = 'c1d4e7a90b22'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('song', 'audio_file_key', existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    # Записи без файла откатить нельзя — сначала их надо убрать,
    # иначе NOT NULL не встанет.
    op.execute("delete from song where audio_file_key is null")
    op.alter_column('song', 'audio_file_key', existing_type=sa.String(255), nullable=False)
