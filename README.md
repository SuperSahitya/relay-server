# Relay Server

A high-performance, scalable backend for the Relay real-time chat application, built with modern technologies to ensure reliability, speed, and type safety.

**Frontend Repository:** [https://github.com/SuperSahitya/relay](https://github.com/SuperSahitya/relay)

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via Drizzle ORM)
- **Real-time:** Socket.io (with Redis Pub/Sub)
- **Message Queue:** Apache Kafka
- **Caching & Store:** Redis
- **Authentication:** Better Auth
- **Validation:** Zod
- **Logging:** Pino

## Key Features

- **Real-time Messaging:** Instant, low-latency chat powered by websockets (Socket.io).
- **Event-Driven Architecture:** Utilizes Apache Kafka to decouple message ingestion from persistence, ensuring high throughput and reliability.
- **Scalable WebSocket Infrastructure:** Utilizes the Redis Pub/Sub model with websockets (Socket.io) to support horizontal scaling across multiple server instances.
- **Robust Presence System:** Real-time user online/offline tracking using Redis keys with TTL-based heartbeats, with Pub/Sub used for presence update fanout.
- **Secure Authentication:** Powered by **Better Auth**, implementing:
  - **JWT & HTTP-Only Cookies:** Secure session management using JSON Web Tokens stored in HTTP-only cookies to prevent XSS attacks.
  - **Google OAuth:** Seamless social login integration.
  - **Email & Password:** Secure credential-based login with mandatory email verification, and the credentials securely hashed and salted before storage.
  - **SMTP Integration:** Uses **Nodemailer** to send verification emails via an SMTP server.
- **Secure & Rate Limited:** Protected by robust authentication middleware and Redis-backed rate limiting to prevent abuse.
- **Type-Safe Development:** Comprehensive TypeScript integration with Zod for runtime request validation.

## API Documentation

### Authentication

- `POST /api/auth/*` - Handled by Better Auth (Sign up, Sign in, etc.)

### User

- `GET /api/users/me` - Get current user profile
- `GET /api/users/:id` - Get specific user profile
- `GET /api/search` - Search for users

### Friends

- `GET /api/friends` - Get list of friends
- `POST /api/friends` - Send a friend request
- `PUT /api/friends/respond` - Accept or decline a friend request
- `DELETE /api/friends/:friendId` - Remove a friend
- `GET /api/friends/requests` - Get received friend requests
- `GET /api/friends/sent` - Get sent friend requests

### Messages

- `GET /api/messages/:friendId` - Get chat history with a friend

## Real-time Events (Socket.io)

### Emitters (Client -> Server)

- `chat_message`: Send a message to a user.
  - Payload: `{ receiverId: string, message: string }`

### Listeners (Server -> Client)

- `chat_message`: Receive a new message.
- `presence_update`: Receive updates on friends' online status.

## Setup & Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/SuperSahitya/relay-server.git
    cd relay-server
    ```

2.  **Install dependencies**

    ```bash
    pnpm install
    ```

3.  **Start Infrastructure (Docker)**

    This project uses Docker Compose to run **PostgreSQL**, **Redis**, and **Apache Kafka**.

    ```bash
    docker-compose up -d
    ```

4.  **Environment Variables**

    Create a `.env` file and configure the environment variables as per `.env.example`.

5.  **Run Database Migrations**

    ```bash
    pnpm db:push
    ```

6.  **Start the Server**
    ```bash
    pnpm dev
    ```
