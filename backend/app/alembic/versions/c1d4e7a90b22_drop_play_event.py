"""drop play_event

Журнал прослушиваний убран вместе с рекомендациями: он существовал,
чтобы давать им семена, и после удаления sync потребителей не осталось.

Revision ID: c1d4e7a90b22
Revises: b3a66cbfd24a
Create Date: 2026-09-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d4e7a90b22'
down_revision: Union[str, Sequence[str], None] = 'b3a66cbfd24a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Индексы уходят вместе с таблицей, отдельно снимать их не нужно.
    op.drop_table('play_event')


def downgrade() -> None:
    op.create_table(
        'play_event',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('track_id', sa.String(length=64), nullable=False),
        sa.Column('youtube_id', sa.String(length=20), nullable=True),
        sa.Column('author', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('seconds', sa.Integer(), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ['user_id'], ['user.id'],
            name=op.f('play_event_user_id_fkey'), ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('play_event_pkey')),
        sa.UniqueConstraint(
            'user_id', 'track_id', 'started_at', name='play_event_unique'
        ),
    )
    op.create_index(
        'idx_play_user_started_at', 'play_event', ['user_id', 'started_at']
    )
    op.create_index(op.f('play_event_started_at_idx'), 'play_event', ['started_at'])
    op.create_index(op.f('play_event_user_id_idx'), 'play_event', ['user_id'])
    op.create_index(op.f('play_event_youtube_id_idx'), 'play_event', ['youtube_id'])
