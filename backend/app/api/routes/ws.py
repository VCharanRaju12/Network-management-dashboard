from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.security import decode_token

router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        stale = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for conn in stale:
            self.disconnect(conn)


manager = ConnectionManager()


@router.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket, token: str | None = Query(default=None)):
    # Browsers can't attach custom headers (like Authorization) to a
    # WebSocket handshake, so the token travels as a query param instead —
    # this is the standard workaround for authenticating browser WebSockets.
    # Validated the same way as any other JWT: same secret, same expiry
    # check. A missing or invalid token is rejected before the connection
    # is even accepted, so unauthenticated clients never receive live data.
    if not token:
        await websocket.close(code=4401)
        return

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4401)
            return
    except JWTError:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection open; the poller pushes updates via manager.broadcast()
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
