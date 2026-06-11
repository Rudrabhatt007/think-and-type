from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Dict, List, Optional

class GameCreateRequest(BaseModel):
    total_rounds: int = Field(15, ge=1, le=25)
    exclude_u: bool = False
    round_duration: int = Field(15, ge=10, le=60)  # seconds per typing round

class GameResponse(BaseModel):
    id: UUID
    room_code: str
    host_id: Optional[UUID]
    status: str
    current_round: int
    total_rounds: int
    exclude_u: bool
    round_duration: int = 15
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PlayerResponse(BaseModel):
    user_id: UUID
    username: str
    score: int
    is_ready: bool

    class Config:
        from_attributes = True

class GameStateResponse(BaseModel):
    game: GameResponse
    players: List[PlayerResponse]

class AnswerSubmission(BaseModel):
    name: str = Field("", max_length=100)
    place: str = Field("", max_length=100)
    animal: str = Field("", max_length=100)
    thing: str = Field("", max_length=100)

class SubmissionRequest(BaseModel):
    round_number: int
    answers: AnswerSubmission

class ChallengeRequest(BaseModel):
    round_number: int
    target_user_id: UUID
    category: str = Field(..., pattern="^(name|place|animal|thing)$")
    answer_text: str

class VoteRequest(BaseModel):
    challenge_id: UUID
    vote: bool  # True = Invalid, False = Valid

class PointUpdate(BaseModel):
    submission_id: str
    points: int = Field(..., ge=0, le=100)

class AdminUpdatePointsRequest(BaseModel):
    updates: List[PointUpdate]
