import enum

class UserRole(str, enum.Enum):
    RW = "RW"
    RT = "RT"
    WARGA = "WARGA"
    STRANGER = "STRANGER"

class IncidentStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    FALSE_ALARM = "false_alarm"
    EXPIRED = "expired"

class ResponseType(str, enum.Enum):
    GOING = "going"
    FALSE_ALARM = "false_alarm"
    WITNESS = "witness"