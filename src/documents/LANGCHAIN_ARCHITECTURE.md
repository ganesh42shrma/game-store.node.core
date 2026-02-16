# LangChain Architecture & Flow Documentation

This document visualizes the agentic architecture of the Game Store application, utilizing **LangChain**, **LangGraph**, and **LangGraph Swarm**.

## System Overview

The application is divided into two distinct arbitrary "swarms" (multi-agent systems) to handle different types of users:

1.  **User Swarm**: Handles customer interactions (browsing, buying, alerts).
2.  **Admin Swarm**: Handles store management (adding games, enriching metadata).

---

## 1. User Facing Swarm Flow    

The **User Swarm** is orchestrated in `src/agents/game-store-user-swarm.js`. The default entry point is the **ProductDiscovery** agent.

```mermaid
graph TD
    %% Styling
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:2px;
    classDef active fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef tool fill:#fff3e0,stroke:#ff6f00,stroke-dasharray: 5 5;

    User([👤 User]) -->|Message| Entry[Entry Point]
    Entry -->|Default| Discovery

    subgraph "User Swarm"
        direction TB
        
        %% Agents
        Discovery(<b>ProductDiscovery Agent</b><br/>Browsing & Preferences):::active
        Commerce(<b>Commerce Agent</b><br/>Cart & Checkout):::active
        Alerts(<b>Alerts Agent</b><br/>Notifications):::active

        %% Handoffs
        Discovery -->|'I want to buy...'| Commerce
        Discovery -->|'Notify me when...'| Alerts
        
        Commerce -->|'Show me reviews...'| Discovery
        Commerce -->|'Alert me on stock...'| Alerts
        
        Alerts -->|'Search for games...'| Discovery
        Alerts -->|'Buy this game...'| Commerce
    end

    %% Tool Connections
    Discovery --- DiscoveryTools[<b>Tools</b><br/>listProducts<br/>getProduct<br/>getProductReviews<br/>save_pref<br/>get_prefs]:::tool
    
    Commerce --- CommerceTools[<b>Tools</b><br/>add_to_cart<br/>get_user_cart<br/>buy_for_me<br/>get_addresses<br/>get_order]:::tool
    
    Alerts --- AlertsTools[<b>Tools</b><br/>create_alert<br/>list_alerts]:::tool
```

### Agent Responsibilities

*   **ProductDiscovery**: The "Face" of the store. Handles fuzzy intent, searching, and recommending games.
*   **Commerce**: The "Cashier". Handles strict transactional logic, address retrieval, and payment flow.
*   **Alerts**: The "Notifier". Manages subscriptions for price drops and restocks.

---

## 2. Admin Facing Swarm Flow

The **Admin Swarm** is orchestrated in `src/agents/game-store-swarm.js`. The default entry point is the **GamesQA** agent.

```mermaid
graph TD
    %% Styling
    classDef admin fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef creation fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    classDef ext fill:#eceff1,stroke:#455a64,stroke-dasharray: 5 5;

    Admin([COP 👮 Admin]) -->|Message| GamesQA

    subgraph "Admin Swarm"
        direction LR
        
        GamesQA(<b>GamesQA Agent</b><br/>General Queries & Store Info):::admin
        GameCreation(<b>GameCreation Agent</b><br/>Content Management):::creation

        %% Handoffs
        GamesQA -->|'Add new game...'| GameCreation
        GameCreation -->|'General question...'| GamesQA
    end

    %% Detailed Tool Logic for Creation
    subgraph "Game Creation Workflow"
        direction TB
        Start((Start)) --> Check{Game Exists?}
        Check -- Yes --> Update[<b>update_game_product</b><br/>Enrich missing fields only]
        Check -- No --> Search[<b>search_web</b><br/>Find meta info]
        Search --> Images[<b>search_images</b><br/>Find cover art]
        Images --> S3[<b>upload_to_s3</b><br/>Host image]
        S3 --> Create[<b>create_game_product</b><br/>Create new entry]
    end

    GameCreation -.->|Uses| Start
```

### Agent Responsibilities

*   **GamesQA**: General purpose admin assistant. It has access to all "read" tools to answer questions about the store's current state.
*   **GameCreation**: Specialized implementation agent such as:
    *   **Research**: Searches the web for trailers, reviews, and metadata.
    *   **Asset Management**: Downloads images and uploads them to S3.
    *   **Database**: Writes authoritative records to the products database.

---

## 3. Tool Ecosystem & Technical Stack

The system functionality is exposed through discrete tools defined in `langchain`.

```mermaid
classDiagram
    direction RL
    
    class GameStoreTools {
        <<Module>>
        +listProducts()
        +getProduct()
        +getProductReviews()
        +get_user_preferences()
        +save_user_preference()
        +create_product_alert()
        +list_my_alerts()
        +get_user_addresses()
        +get_user_cart()
        +add_to_cart()
        +buy_for_me()
        +get_order()
    }

    class GameCreationTools {
        <<Module>>
        +searchWeb()
        +searchImages()
        +uploadToS3()
        +findGameByTitle()
        +updateGameProduct()
        +createGameProduct()
    }

    class Agents {
        <<Consumers>>
        UserSwarm
        AdminSwarm
    }

    Agents ..> GameStoreTools : Uses
    Agents ..> GameCreationTools : Uses (Admin Only)
```

### Key Libraries
*   **@langchain/langgraph-swarm**: Manages the multi-agent state and handoffs.
*   **@langchain/groq**: Provides high-throughput inference (Llama 3) for the agents.
*   **@langchain/google-genai**: Fallback inference provider (Gemini).
*   **zod**: Ensures strict schema validation for all tool inputs, preventing malformed DB queries.
