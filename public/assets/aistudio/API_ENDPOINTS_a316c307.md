# Especificación de Endpoints: Cozy Leap Online Backend API (v1)

**Base URL:** `http://localhost:3000/api/v1`  
**Formato de Intercambio:** `application/json`  
**Autenticación:** Cabecera `Authorization: Bearer <accessToken>`

---

## 1. Tablas de Ranking / Leaderboards (`/api/v1/leaderboard`)

### 1.1. `GET /api/v1/leaderboard/:levelId`
Retorna las tablas de ranking de los **3 modos de juego**:
- **`normal`**: Partidas en modo regular / libre.
- **`contrareloj`**: Partidas contra el reloj (menor tiempo en segundos).
- **`persecucion`**: Partidas de persecución y escape.

> **Importante:** Esta tabla **no contiene datos falsos ni bots precargados**. Solo refleja partidas reales registradas por jugadores legítimos.

#### Parámetros:
- **Ruta:** `levelId` (número entero positivo, ej. `1`, `2`, `3`).
- **Query Params (Opcionales):**
  - `limit`: Cantidad máxima de registros por tabla (1 a 100, default: `50`).
  - `mode`: Si deseas filtrar una tabla específica (`normal`, `contrareloj`, `persecucion`). Si no se envía, retorna las 3 tablas completas en `tables`.

#### Ejemplo de Petición:
```http
GET /api/v1/leaderboard/1 HTTP/1.1
Host: localhost:3000
```

#### Ejemplo de Respuesta `200 OK`:
```json
{
  "status": "success",
  "levelId": 1,
  "mode": "all",
  "tables": {
    "normal": [
      {
        "rank": 1,
        "userId": "usr_98af7a",
        "username": "Saltarin_Pro",
        "timeSeconds": 16.42,
        "collectiblesFound": 4,
        "createdAt": "2026-11-05T18:10:00.000Z"
      }
    ],
    "contrareloj": [
      {
        "rank": 1,
        "userId": "usr_12bc4d",
        "username": "SpeedRunner",
        "timeSeconds": 11.25,
        "collectiblesFound": 5,
        "createdAt": "2026-11-05T18:12:30.000Z"
      }
    ],
    "persecucion": [
      {
        "rank": 1,
        "userId": "usr_77de8a",
        "username": "EscapeMaster",
        "timeSeconds": 21.80,
        "collectiblesFound": 3,
        "createdAt": "2026-11-05T18:14:00.000Z"
      }
    ]
  },
  "counts": {
    "normal": 1,
    "contrareloj": 1,
    "persecucion": 1,
    "total": 3
  }
}
```

---

### 1.2. `GET /api/v1/leaderboard`
Retorna el resumen de rankings de los 3 modos para todos los niveles activos (del 1 al 5).

---

## 2. Registro de Partidas & Anti-Cheat (`/api/v1/player/complete-level`)

### `POST /api/v1/player/complete-level`
Permite a un jugador registrar el resultado de un nivel en cualquiera de los 3 modos de juego.

- **Headers:**  
  `Authorization: Bearer <accessToken>`  
  `Content-Type: application/json`

- **Request Body:**
```json
{
  "levelId": 1,
  "timeSeconds": 14.85,
  "walnutRelicsFound": 2,
  "crystalRelicsFound": 1,
  "mode": "contrareloj"
}
```

| Campo | Tipo | Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| `levelId` | `number` | **Sí** | Número del nivel completado. |
| `timeSeconds` | `number` | **Sí** | Tiempo registrado en segundos. Debe superar el umbral físico del nivel para evitar trampas. |
| `walnutRelicsFound` | `number` | No | Reliquias de **nuez** encontradas en el nivel (~2 por nivel). |
| `crystalRelicsFound` | `number` | No | Reliquias de **cristal** encontradas (~1 cada 2 niveles). |
| `relicsFound` | `number` | No | Alias heredado si no se envía `walnutRelicsFound` (0 a 50). Default: `0`. |
| `mode` | `string` | No | `"normal"`, `"contrareloj"` o `"persecucion"`. Default: `"normal"`. |

- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Level completion validated and recorded",
  "data": {
    "record": {
      "_id": "rec_mw43a8_91f",
      "userId": "usr_98af7a",
      "username": "Saltarin_Pro",
      "levelId": 1,
      "mode": "contrareloj",
      "timeSeconds": 14.85,
      "collectiblesFound": 3,
      "createdAt": "2026-11-05T18:15:00.000Z"
    },
    "rank": 1,
    "isNewBest": true,
    "walnutRelicsEarned": 2,
    "crystalRelicsEarned": 1,
    "relicsEarned": 3,
    "currencies": { "walnut": 2, "crystal": 1 },
    "walnutBalance": 2,
    "crystalBalance": 1,
    "relicsBalance": 2,
    "progress": {
      "maxUnlockedLevel": 2,
      "completedLevels": [1],
      "totalCollectiblesFound": 3,
      "totalWalnutRelicsFound": 2,
      "totalCrystalRelicsFound": 1
    },
    "antiCheatCheck": {
      "passed": true,
      "verifiedAt": "2026-11-05T18:15:00.000Z",
      "minPhysicalTime": 4.5
    }
  }
}
```

---

## 3. Autenticación (`/api/v1/auth`)

| Método | Endpoint | Descripción | Body |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Crea una cuenta de jugador con hash Argon2/bcrypt | `{ username, email, password, displayName? }` |
| `POST` | `/api/v1/auth/login` | Inicia sesión con rate limit (5 intentos / 15m) | `{ email, password, deviceId? }` |
| `POST` | `/api/v1/auth/refresh` | Rota silenciosamente el Access Token | `{ refreshToken? }` o Cookie |
| `POST` | `/api/v1/auth/logout` | Revoca la sesión en Redis | `{ refreshToken?, userId? }` |

---

## 4. Jugador, Personalización de Personaje & Amigos (`/api/v1/player`)
*(Requieren `Authorization: Bearer <accessToken>`)*

| Método | Endpoint | Descripción | Body / Respuesta |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/player/me` | Obtiene perfil, progreso, `currencies` (`walnut`/`crystal`), `unlockedItems`, `equippedItems` y apariencia | Perfil completo |
| `PUT` / `PATCH` | `/api/v1/player/appearance` | Actualiza **sin sobrescribir** campos omitidos (colores, pelo, chamarra, piel, gorro, etc.) | `{ skinColor?, hairStyle?, shirtStyle?, shirtColor?, hat?, ... }` |
| `GET` | `/api/v1/player/character` | Obtiene el estado completo del editor de personaje (`appearance`, `equippedByCategory`, `unlockedItems`, `currencies`) | Estado completo del personaje |
| `PUT` / `PATCH` | `/api/v1/player/character` | **Editor completo del personaje**: edita cualquier rasgo/color/ropa, equipa ítems de tienda y des-equipa categorías en una sola llamada sin perder personalización previa | `{ appearance?, equipItemIds?, unequipCategories?, resetToDefault? }` |
| `PUT` | `/api/v1/player/inventory` | Actualiza los 5 slots de la mochila | `{ slots: ['baya', 'nuez', ...] }` |
| `GET` | `/api/v1/player/friends` | Lista amigos aceptados y solicitudes pendientes | `{ friends, incomingPending, outgoingPending }` |
| `POST` | `/api/v1/player/friends/request` | Envía solicitud de amistad | `{ targetUsername: "nombre" }` |
| `POST` | `/api/v1/player/friends/accept/:requestId` | Acepta solicitud | Ninguno |
| `POST` | `/api/v1/player/friends/decline/:requestId` | Rechaza solicitud | Ninguno |

### Ejemplo de edición completa (`PATCH /api/v1/player/character`)
Permite editar libremente piel, cabello, chamarra, pantalones, nombre, etc., y al mismo tiempo equipar artículos comprados en la tienda sin reiniciar el personaje:
```json
{
  "appearance": {
    "bodyType": "chica",
    "skinColor": "#e0a96d",
    "hairStyle": "ponytail",
    "hairColor": "#1e293b",
    "shirtStyle": "varsity_jacket",
    "shirtColor": "#dc2626",
    "pantsColor": "#0f172a"
  },
  "equipItemIds": ["hat_explorador", "pattern_stripes"],
  "unequipCategories": ["glasses"]
}
```
*(También acepta las propiedades de apariencia directamente en la raíz del JSON sin anidar dentro de `appearance`).*

---

## 4.1. Salas Multijugador REST (`/api/v1/rooms`)
*(Documentación completa en detalle en `ROOMS_API.md`)*

| Método | Endpoint | Descripción | Body / Respuesta |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/rooms/create` | Crea o registra un código de sala | `{ levelId?: 1, customCode?: "amigos" }` |
| `GET` | `/api/v1/rooms` | Lista todas las salas activas y jugadores | `{ totalActiveRooms, rooms }` |
| `GET` | `/api/v1/rooms/my-room` | Obtiene la sala activa del usuario autenticado | `{ roomId, levelId, players, spectatorCount }` |
| `GET` | `/api/v1/rooms/:roomId` | Obtiene el estado detallado de una sala | Detalle de jugadores, meta y espectadores |

---

## 5. WebSockets & Salas Multijugador en Tiempo Real (`ws://<host>:3000`)

### 5.1. Conexión & Handshake
Conectar con Socket.io pasando el token de autenticación:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: accessToken } // o query: { token: accessToken }
});
```

---

### 5.2. Unirse a una Sala (`room:join`)
Soporta partidas de hasta 10 jugadores simultáneos.
```javascript
// Enviar al servidor:
socket.emit('room:join', {
  levelId: 1,
  roomId: 'mi_sala_amigos' // Opcional. Si se omite, agrupa automáticamente en 'party_level_1'
});
```

---

### 5.3. Respuesta del Servidor al Unirse (`room:state`)
El servidor emite `room:state` al jugador que se une con la lista de todos los participantes y su spawn inicial.

**Estructura del Payload JSON:**
```json
{
  "levelId": 1,
  "roomId": "party_mi_sala_amigos",
  "yourSpawn": { "x": 0.0, "y": 1.0, "z": 0.0 },
  "players": [
    {
      "userId": "usr_98af7a",
      "id": "usr_98af7a",
      "username": "carlos_gamer",
      "displayName": "Carlos El Aventurero",
      "name": "Carlos El Aventurero",
      "playerName": "Carlos El Aventurero",
      "tag": "Carlos El Aventurero",
      "label": "Carlos El Aventurero",
      "appearance": {
        "bodyType": "chico",
        "skinColor": "#f8d5b8",
        "hairStyle": "cozy_messy",
        "hairColor": "#4a2e18",
        "shirtStyle": "hoodie",
        "shirtColor": "#4f46e5",
        "pantsStyle": "joggers",
        "pantsColor": "#1e293b",
        "shoesColor": "#f97316",
        "hat": "beanie_cozy",
        "glasses": "none",
        "backpack": "explorer_pack",
        "companion": "estrella"
      },
      "x": 0.0,
      "y": 1.0,
      "z": 0.0,
      "yaw": 0,
      "anim": "idle",
      "position": { "x": 0.0, "y": 1.0, "z": 0.0, "yaw": 0 },
      "lastUpdate": 1741250000000,
      "socketId": "sock_abc123",
      "levelId": 1
    }
  ],
  "self": {
    "userId": "usr_98af7a",
    "id": "usr_98af7a",
    "username": "carlos_gamer",
    "displayName": "Carlos El Aventurero",
    "name": "Carlos El Aventurero",
    "playerName": "Carlos El Aventurero",
    "tag": "Carlos El Aventurero",
    "label": "Carlos El Aventurero"
  }
}
```

> **Nota para el Frontend:**  
> Se incluyen todos los alias de nombre comunes (`displayName`, `name`, `playerName`, `tag`, `label`, `username`, `id`, `userId`) para que la etiqueta sobre la cabeza del personaje siempre tome el nombre real del usuario sin importar qué propiedad lea el frontend.

---

### 5.4. Notificación a los Otros Jugadores (`player:joined`)
Emitido a los demás jugadores de la misma sala cuando alguien nuevo entra:
```json
{
  "userId": "usr_77de8a",
  "id": "usr_77de8a",
  "username": "maria_pro",
  "displayName": "María Pro",
  "name": "María Pro",
  "playerName": "María Pro",
  "tag": "María Pro",
  "label": "María Pro",
  "appearance": { ... },
  "x": 2.5,
  "y": 1.0,
  "z": -1.5,
  "yaw": 0,
  "anim": "idle",
  "position": { "x": 2.5, "y": 1.0, "z": -1.5, "yaw": 0 },
  "lastUpdate": 1741250000100,
  "levelId": 1
}
```

---

### 5.5. Sincronización de Movimiento (`player:sync` & `player:moved`)
- **Cliente envía (`player:sync`):**
```javascript
socket.emit('player:sync', {
  x: 5.2,
  y: 1.0,
  z: -3.4,
  yaw: 1.57,
  anim: 'run',
  action: 'jump' // opcional
});
```
- **Servidor retransmite (`player:moved`) a los demás:**
```json
{
  "userId": "usr_77de8a",
  "id": "usr_77de8a",
  "username": "maria_pro",
  "displayName": "María Pro",
  "name": "María Pro",
  "playerName": "María Pro",
  "x": 5.2,
  "y": 1.0,
  "z": -3.4,
  "yaw": 1.57,
  "anim": "run",
  "action": "jump",
  "position": { "x": 5.2, "y": 1.0, "z": -3.4, "yaw": 1.57 }
}
```

---

### 5.6. Salida de Jugador (`player:left`)
```json
{
  "userId": "usr_77de8a",
  "id": "usr_77de8a",
  "username": "maria_pro",
  "displayName": "María Pro",
  "name": "María Pro",
  "playerName": "María Pro",
  "reason": "leave" // o "disconnect"
}
```

---

### 5.7. Invitaciones de Amigos a Partidas Multijugador
- **Enviar invitación (`invite:send`):**
```javascript
socket.emit('invite:send', {
  toUserId: 'usr_amigo_123',
  levelId: 1,
  roomId: 'party_sala_actual' // Opcional: si ya estás en una sala, los amigos se unen a la misma
});
```
- **Amigo recibe invitación (`invite:received`):**
```json
{
  "inviteId": "inv_9b81_ab2c",
  "fromUserId": "usr_host_99",
  "fromUsername": "Carlos El Aventurero",
  "levelId": 1,
  "roomId": "party_sala_actual",
  "expiresInSeconds": 60
}
```
- **Responder invitación (`invite:respond`):**
```javascript
socket.emit('invite:respond', {
  inviteId: 'inv_9b81_ab2c',
  accept: true
});
```
- **Resultado emitido a ambos (`invite:result`):**
```json
{
  "inviteId": "inv_9b81_ab2c",
  "accepted": true,
  "roomId": "party_sala_actual",
  "levelId": 1
}
```
*Ambos clientes proceden a emitir `room:join` con el mismo `roomId` obtenido en `invite:result`, permitiendo que 3, 4 o más amigos se unan secuencialmente a la misma sala sin desincronizarse.*

---

## 6. Tienda de Cosméticos / Sistema de 2 Monedas y 4 Tiers (`/api/v1/shop`)

La tienda utiliza **2 monedas** obtenidas en los niveles (`POST /api/v1/player/complete-level`):
- **Reliquias de Nuez (`walnut`)**: ~2 por nivel.
- **Reliquias de Cristal (`crystal`)**: ~1 cada 2 niveles (mayor valor y escasez).

### Tiers de Objetos y Rangos de Precio
| Tier (`tier`) | Etiqueta | Rango de Precio |
| :--- | :--- | :--- |
| `common` | Común | `0` (iniciales) o `3–6` Nueces (`0` Cristales) |
| `epic` | Épico | `7–12` Nueces + `1–2` Cristales |
| `golden` | Dorado | `12–17` Nueces + `3–5` Cristales |
| `mythic` | Mítico | `18–26` Nueces + `6–9` Cristales |

### Categorías disponibles (11)
`skin` (Pieles), `hat` (Gorros y Sombreros), `outfit` (Conjuntos), `pattern` (Patrones), `glasses` (Lentes y Visores), `backpack` (Mochilas y Alas), `hair` (Peinados), `accessory` (Accesorios), `shoes` (Calzado), `aura` (Auras y Estelas), `companion` (Compañeros).

---

### 6.1. `GET /api/v1/shop/catalog`
Retorna el catálogo completo de la tienda. Si se envía `Authorization: Bearer <accessToken>`, cada ítem incluye `owned`, `equipped`, `canAfford` y `missingCurrencies`, además de `currencies: { walnut, crystal }`.

- **Query Params (Opcionales):**
  - `category`: Filtra por cualquiera de las 11 categorías.
  - `tier` (o `rarity`): Filtra por tier (`common`, `epic`, `golden`, `mythic`).
  - `onlyOwned`: `"true"` para ver solo lo desbloqueado.

- **Response `200 OK`:**
```json
{
  "status": "success",
  "data": {
    "currencies": { "walnut": 10, "crystal": 2 },
    "walnutBalance": 10,
    "crystalBalance": 2,
    "relicsBalance": 10,
    "tiers": [
      { "id": "common", "label": "Común", "color": "#94a3b8", "order": 1 },
      { "id": "epic", "label": "Épico", "color": "#a855f7", "order": 2 },
      { "id": "golden", "label": "Dorado", "color": "#facc15", "order": 3 },
      { "id": "mythic", "label": "Mítico", "color": "#f43f5e", "order": 4 }
    ],
    "categories": [
      { "id": "skin", "label": "Pieles" },
      { "id": "hat", "label": "Gorros y Sombreros" }
    ],
    "totalItems": 73,
    "items": [
      {
        "id": "outfit_neon_runner",
        "category": "outfit",
        "name": "Conjunto Corredor Neón",
        "description": "Atuendo aerodinámico magenta y cian de Ciudad Neón.",
        "tier": "epic",
        "rarity": "epic",
        "priceWalnut": 11,
        "priceCrystal": 2,
        "price": { "walnut": 11, "crystal": 2 },
        "priceRelics": 11,
        "previewColor": "#ec4899",
        "appearancePatch": {
          "outfit": "neon_runner",
          "shirtStyle": "cyber_jacket",
          "shirtColor": "#ec4899",
          "pantsStyle": "tech_pants",
          "pantsColor": "#0f172a",
          "shoesColor": "#22d3ee"
        },
        "owned": false,
        "equipped": false,
        "canAfford": false,
        "missingCurrencies": { "walnut": 1, "crystal": 0 }
      }
    ]
  }
}
```

---

### 6.2. `GET /api/v1/shop/inventory`
*(Requiere `Authorization: Bearer <accessToken>`)*  
Retorna `currencies` (`{ walnut, crystal }`), ítems desbloqueados, `equippedByCategory`, apariencia actual e historial de compras.

---

### 6.3. `POST /api/v1/shop/purchase`
*(Requiere `Authorization: Bearer <accessToken>`)*  
Desbloquea un ítem descontando su costo en `walnutBalance` y `crystalBalance`. Acepta opcionalmente `currentAppearance` para conservar cualquier cambio local de personaje si `autoEquip: true`.

- **Request Body:**
```json
{
  "itemId": "hat_explorador",
  "autoEquip": true,
  "currentAppearance": {
    "skinColor": "#8d5524",
    "hairStyle": "ponytail",
    "shirtColor": "#dc2626"
  }
}
```

- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "'Sombrero de Explorador' desbloqueado con éxito",
  "data": {
    "purchasedItem": {
      "id": "hat_explorador",
      "category": "hat",
      "tier": "common",
      "priceWalnut": 4,
      "priceCrystal": 0
    },
    "currencies": { "walnut": 6, "crystal": 2 },
    "walnutBalance": 6,
    "crystalBalance": 2,
    "spent": { "walnut": 4, "crystal": 0 },
    "unlockedItems": ["skin_natural", "hat_none", "hat_explorador"],
    "equipped": true,
    "appliedPatch": { "hat": "gorro_explorador" },
    "equippedByCategory": { "hat": "hat_explorador" },
    "appearance": {
      "skinColor": "#8d5524",
      "hairStyle": "ponytail",
      "shirtColor": "#dc2626",
      "hat": "gorro_explorador"
    }
  }
}
```

- **Errores posibles:**
  - `400 INSUFFICIENT_RELICS`: Faltan nueces o cristales (`details: { required, available, missing }`).
  - `409 ALREADY_OWNED`: El ítem ya estaba desbloqueado.
  - `404 ITEM_NOT_FOUND`: El `itemId` no existe.

---

### 6.4. `POST /api/v1/shop/equip`
*(Requiere `Authorization: Bearer <accessToken>`)*  
Equipa uno o varios ítems desbloqueados **fusionando únicamente su slot (`appearancePatch`)** sobre la apariencia actual del personaje sin resetear piel, pelo, chamarra ni colores personalizados. Opcionalmente recibe `currentAppearance` por si el cliente tiene cambios locales sin guardar.

- **Request Body:**
```json
{
  "itemIds": ["hat_explorador", "pattern_stripes"],
  "currentAppearance": {
    "skinColor": "#8d5524",
    "shirtStyle": "varsity_jacket",
    "shirtColor": "#dc2626"
  }
}
```
*(También acepta `{ "itemId": "hat_explorador" }` para un solo ítem).*

- **Response `200 OK`:** Incluye `equippedItems`, `appliedPatch`, `equippedByCategory` y el `appearance` completo preservado.
- **Error `403 ITEM_LOCKED`:** Si el jugador intenta equipar un ítem de pago que aún no ha desbloqueado en la tienda.

---

### 6.5. `POST /api/v1/shop/unequip`
*(Requiere `Authorization: Bearer <accessToken>`)*  
Quita uno o varios accesorios/categorías sin tocar el resto del personaje.

- **Request Body:**
```json
{
  "categories": ["hat", "glasses"]
}
```
*(También acepta `{ "category": "hat" }` o `{ "itemId": "hat_explorador" }`, más `currentAppearance` opcional).*
