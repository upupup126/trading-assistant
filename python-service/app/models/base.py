"""
基础数据模型
"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel as PydanticBaseModel, Field


class BaseModel(PydanticBaseModel):
    """基础模型类"""
    
    class Config:
        # 允许使用字段别名
        allow_population_by_field_name = True
        # 验证赋值
        validate_assignment = True
        # 使用枚举值
        use_enum_values = True
        # JSON编码器
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }


class TimestampMixin(BaseModel):
    """时间戳混入类"""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class UUIDMixin(BaseModel):
    """UUID混入类"""
    id: UUID = Field(default_factory=uuid4)


class APIResponse(BaseModel):
    """API响应基础模型"""
    success: bool = True
    message: str = "操作成功"
    data: Optional[dict] = None
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    
    @property
    def offset(self) -> int:
        """计算偏移量"""
        return (self.page - 1) * self.page_size


class PaginatedResponse(APIResponse):
    """分页响应模型"""
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0
    
    def __init__(self, **data):
        super().__init__(**data)
        if self.total > 0 and self.page_size > 0:
            self.total_pages = (self.total + self.page_size - 1) // self.page_size