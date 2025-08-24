# Daylight Architecture Diagrams

This document contains detailed architecture diagrams for the Daylight system.

## System Overview

```mermaid
graph TB
    %% User Layer
    User[👤 User Browser]
    
    %% CDN Layer
    User --> CF[☁️ CloudFront CDN]
    
    %% Static Assets
    CF --> S3[📦 S3 Static Website<br/>React SPA]
    
    %% API Layer
    CF --> APIGW[🚪 API Gateway v2<br/>HTTP API]
    
    %% Compute Layer
    APIGW --> Plan[⚡ Plan Lambda<br/>Scoring Engine]
    APIGW --> Trips[⚡ Trips Lambda<br/>CRUD Operations]
    APIGW --> Health[⚡ Health Lambda<br/>Status Checks]
    
    %% Storage Layer
    Plan --> DDB[(🗄️ DynamoDB<br/>Trips Table)]
    Trips --> DDB
    Plan --> Cache[(⚡ DynamoDB<br/>Cache Table)]
    
    %% External Services
    Plan --> Places[🌍 Google Places API<br/>Location Data]
    
    %% Security & Secrets
    SM[🔐 Secrets Manager<br/>API Keys] --> Plan
    SM --> Trips
    
    %% Monitoring
    CW[📊 CloudWatch<br/>Logs & Metrics] --> Plan
    CW --> Trips
    CW --> APIGW
    
    %% Security
    WAF[🛡️ AWS WAF<br/>Rate Limiting] --> CF
    
    %% Frontend Components
    S3 --> React[⚛️ React App]
    React --> Router[🛤️ React Router<br/>SPA Routing]
    React --> Store[🏪 Zustand Store<br/>State Management]
    React --> UI[🎨 Tailwind UI<br/>Component Library]
    React --> Map[🗺️ Mapbox GL JS<br/>Interactive Maps]
    
    %% Backend Components
    Plan --> Engine[🧮 Scoring Engine<br/>Trip Optimization]
    Plan --> HTTP[🌐 HTTP Utils<br/>API Clients]
    Trips --> Dynamo[📊 DynamoDB Client<br/>Data Access]
    
    %% Styling
    classDef userLayer fill:#e1f5fe
    classDef cdnLayer fill:#f3e5f5
    classDef apiLayer fill:#e8f5e8
    classDef computeLayer fill:#fff3e0
    classDef storageLayer fill:#fce4ec
    classDef externalLayer fill:#f1f8e9
    classDef securityLayer fill:#ffebee
    classDef monitoringLayer fill:#e0f2f1
    
    class User userLayer
    class CF cdnLayer
    class S3,APIGW apiLayer
    class Plan,Trips,Health computeLayer
    class DDB,Cache storageLayer
    class Places externalLayer
    class SM,WAF securityLayer
    class CW monitoringLayer
```

## Data Flow Diagrams

### 1. User Search Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant CF as CloudFront
    participant S3 as S3 Bucket
    participant AG as API Gateway
    participant PL as Plan Lambda
    participant GP as Google Places
    participant SE as Scoring Engine
    participant DB as DynamoDB
    
    U->>CF: Request /search
    CF->>S3: Serve React SPA
    S3-->>CF: Static assets
    CF-->>U: HTML/JS/CSS
    
    Note over U: User types search query
    
    U->>CF: POST /api/plan
    CF->>AG: Route to API
    AG->>PL: Invoke Plan Lambda
    
    PL->>GP: Search places
    GP-->>PL: Place results
    
    PL->>SE: Score candidates
    SE-->>PL: Scored suggestions
    
    PL->>DB: Cache results
    DB-->>PL: Confirm
    
    PL-->>AG: Return suggestions
    AG-->>CF: HTTP response
    CF-->>U: Search results
```

### 2. Trip Management Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant CF as CloudFront
    participant AG as API Gateway
    participant TL as Trips Lambda
    participant DB as DynamoDB
    participant SM as Secrets Manager
    
    U->>CF: POST /api/trips
    CF->>AG: Route to API
    AG->>TL: Invoke Trips Lambda
    
    TL->>SM: Get encryption keys
    SM-->>TL: Return keys
    
    TL->>DB: Create trip record
    DB-->>TL: Return trip ID
    
    TL-->>AG: Return trip data
    AG-->>CF: HTTP response
    CF-->>U: Trip created
    
    Note over U: User updates trip
    
    U->>CF: PUT /api/trips/{id}
    CF->>AG: Route to API
    AG->>TL: Invoke Trips Lambda
    
    TL->>DB: Update trip record
    DB-->>TL: Confirm update
    
    TL-->>AG: Return updated trip
    AG-->>CF: HTTP response
    CF-->>U: Trip updated
```

## Component Architecture

### Frontend Architecture

```mermaid
graph TB
    subgraph "Browser"
        subgraph "React Application"
            App[App.tsx<br/>Root Component]
            Router[React Router<br/>Routing Logic]
            
            subgraph "Pages"
                Plan[Plan.tsx<br/>Main Planning Interface]
                NotFound[NotFound.tsx<br/>404 Page]
            end
            
            subgraph "Components"
                Map[MapView.tsx<br/>Mapbox Integration]
                Search[SearchInput.tsx<br/>Debounced Search]
                Results[ResultsList.tsx<br/>Place Results]
                Toast[Toast.tsx<br/>Notifications]
                ErrorBoundary[ErrorBoundary.tsx<br/>Error Handling]
            end
            
            subgraph "State Management"
                Store[Zustand Store<br/>Global State]
                LocalState[React Hooks<br/>Local State]
            end
            
            subgraph "Utilities"
                API[API Client<br/>HTTP Requests]
                Utils[Utility Functions<br/>Helpers]
                ErrorHandling[Error Handling<br/>Correlation IDs]
            end
        end
        
        subgraph "Build Tools"
            Vite[Vite<br/>Build Tool]
            TypeScript[TypeScript<br/>Type System]
            Tailwind[Tailwind CSS<br/>Styling]
        end
    end
    
    %% Connections
    App --> Router
    Router --> Plan
    Router --> NotFound
    Plan --> Map
    Plan --> Search
    Plan --> Results
    Plan --> Toast
    App --> ErrorBoundary
    
    Search --> Store
    Results --> Store
    Map --> Store
    
    Store --> API
    API --> Utils
    API --> ErrorHandling
    
    %% Build connections
    Vite --> App
    TypeScript --> App
    Tailwind --> App
```

### Backend Architecture

```mermaid
graph TB
    subgraph "AWS Lambda Runtime"
        subgraph "Plan Lambda"
            PlanHandler[plan.ts<br/>Request Handler]
            ScoringEngine[scoring.ts<br/>Algorithm Engine]
            PlacesClient[places.ts<br/>Google API Client]
            CacheLayer[cache.ts<br/>LRU + DynamoDB]
        end
        
        subgraph "Trips Lambda"
            TripsHandler[trips.ts<br/>CRUD Handler]
            DynamoClient[dynamo.ts<br/>Database Client]
            Validation[validation.ts<br/>Input Validation]
        end
        
        subgraph "Health Lambda"
            HealthHandler[health.ts<br/>Status Checks]
            Dependencies[deps.ts<br/>Dependency Health]
        end
        
        subgraph "Shared Libraries"
            HTTPUtils[http.ts<br/>Response Helpers]
            ErrorHandling[errors.ts<br/>Error Management]
            Types[types.ts<br/>TypeScript Definitions]
            Config[config.ts<br/>Environment Config]
        end
    end
    
    subgraph "External Dependencies"
        GoogleAPI[Google Places API]
        DynamoDB[DynamoDB Tables]
        SecretsManager[Secrets Manager]
        CloudWatch[CloudWatch Logs]
    end
    
    %% Plan Lambda connections
    PlanHandler --> ScoringEngine
    PlanHandler --> PlacesClient
    PlanHandler --> CacheLayer
    PlacesClient --> GoogleAPI
    CacheLayer --> DynamoDB
    
    %% Trips Lambda connections
    TripsHandler --> DynamoClient
    TripsHandler --> Validation
    DynamoClient --> DynamoDB
    
    %% Health Lambda connections
    HealthHandler --> Dependencies
    Dependencies --> DynamoDB
    Dependencies --> GoogleAPI
    
    %% Shared connections
    PlanHandler --> HTTPUtils
    TripsHandler --> HTTPUtils
    HealthHandler --> HTTPUtils
    
    PlanHandler --> ErrorHandling
    TripsHandler --> ErrorHandling
    HealthHandler --> ErrorHandling
    
    PlacesClient --> SecretsManager
    DynamoClient --> SecretsManager
    
    PlanHandler --> CloudWatch
    TripsHandler --> CloudWatch
    HealthHandler --> CloudWatch
```

## Infrastructure Architecture

### AWS Services Layout

```mermaid
graph TB
    subgraph "Edge Layer"
        Route53[Route 53<br/>DNS]
        CloudFront[CloudFront CDN<br/>Global Distribution]
        WAF[AWS WAF<br/>Security Rules]
    end
    
    subgraph "Application Layer"
        subgraph "Frontend"
            S3[S3 Bucket<br/>Static Website]
            OAC[Origin Access Control<br/>Security]
        end
        
        subgraph "API Layer"
            APIGW[API Gateway v2<br/>HTTP API]
            Authorizer[Lambda Authorizer<br/>Optional Auth]
        end
        
        subgraph "Compute Layer"
            Lambda1[Plan Lambda<br/>nodejs20.x]
            Lambda2[Trips Lambda<br/>nodejs20.x]
            Lambda3[Health Lambda<br/>nodejs20.x]
        end
    end
    
    subgraph "Data Layer"
        subgraph "Primary Storage"
            DynamoDB1[Trips Table<br/>Main Data]
            DynamoDB2[Cache Table<br/>Performance]
        end
        
        subgraph "Configuration"
            SecretsManager[Secrets Manager<br/>API Keys]
            ParameterStore[Parameter Store<br/>Configuration]
        end
    end
    
    subgraph "Monitoring & Security"
        CloudWatch[CloudWatch<br/>Logs & Metrics]
        XRay[X-Ray<br/>Distributed Tracing]
        IAM[IAM Roles<br/>Permissions]
    end
    
    subgraph "External Services"
        GooglePlaces[Google Places API]
        Mapbox[Mapbox GL JS]
    end
    
    %% Connections
    Route53 --> CloudFront
    WAF --> CloudFront
    CloudFront --> S3
    CloudFront --> APIGW
    OAC --> S3
    
    APIGW --> Lambda1
    APIGW --> Lambda2
    APIGW --> Lambda3
    Authorizer --> APIGW
    
    Lambda1 --> DynamoDB1
    Lambda1 --> DynamoDB2
    Lambda2 --> DynamoDB1
    Lambda3 --> DynamoDB1
    
    Lambda1 --> SecretsManager
    Lambda2 --> SecretsManager
    Lambda1 --> ParameterStore
    
    Lambda1 --> CloudWatch
    Lambda2 --> CloudWatch
    Lambda3 --> CloudWatch
    
    Lambda1 --> XRay
    Lambda2 --> XRay
    Lambda3 --> XRay
    
    IAM --> Lambda1
    IAM --> Lambda2
    IAM --> Lambda3
    
    Lambda1 --> GooglePlaces
    S3 --> Mapbox
```

## Security Architecture

### Security Layers

```mermaid
graph TB
    subgraph "Network Security"
        WAF[AWS WAF<br/>• Rate limiting<br/>• IP filtering<br/>• Bot protection]
        CloudFront[CloudFront<br/>• DDoS protection<br/>• SSL termination<br/>• Geographic restrictions]
    end
    
    subgraph "Application Security"
        CORS[CORS Policy<br/>• Origin validation<br/>• Method restrictions<br/>• Header controls]
        
        InputValidation[Input Validation<br/>• Schema validation<br/>• Sanitization<br/>• Type checking]
        
        ErrorHandling[Error Handling<br/>• Safe error messages<br/>• Correlation IDs<br/>• No data leakage]
    end
    
    subgraph "Infrastructure Security"
        IAM[IAM Roles<br/>• Least privilege<br/>• Resource-based<br/>• Time-limited tokens]
        
        VPC[VPC Security<br/>• Private subnets<br/>• Security groups<br/>• NACLs]
        
        Encryption[Encryption<br/>• Data at rest<br/>• Data in transit<br/>• Key management]
    end
    
    subgraph "Data Security"
        DynamoDB[DynamoDB<br/>• Encryption at rest<br/>• Access logging<br/>• Point-in-time recovery]
        
        Secrets[Secrets Manager<br/>• Encrypted storage<br/>• Automatic rotation<br/>• Audit trail]
        
        Logs[CloudWatch Logs<br/>• Encrypted logs<br/>• Access controls<br/>• Retention policies]
    end
    
    subgraph "API Security"
        Authentication[Authentication<br/>• Optional JWT<br/>• API key validation<br/>• User context]
        
        Authorization[Authorization<br/>• Resource access<br/>• Operation permissions<br/>• Data filtering]
        
        RateLimit[Rate Limiting<br/>• Per-IP limits<br/>• Per-user quotas<br/>• Burst protection]
    end
    
    %% Security flow
    WAF --> CloudFront
    CloudFront --> CORS
    CORS --> InputValidation
    InputValidation --> Authentication
    Authentication --> Authorization
    Authorization --> IAM
    IAM --> VPC
    VPC --> Encryption
    Encryption --> DynamoDB
    Encryption --> Secrets
    Encryption --> Logs
    Authorization --> RateLimit
    
    ErrorHandling --> Logs
```

## Deployment Architecture

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Source Control"
        GitHub[GitHub Repository<br/>• Feature branches<br/>• Pull requests<br/>• Code reviews]
    end
    
    subgraph "CI Pipeline"
        Actions[GitHub Actions<br/>• Automated testing<br/>• Code quality<br/>• Security scans]
        
        Build[Build Process<br/>• TypeScript compilation<br/>• Bundle optimization<br/>• Asset processing]
        
        Test[Test Suite<br/>• Unit tests<br/>• Integration tests<br/>• E2E tests]
    end
    
    subgraph "CD Pipeline"
        Deploy[Terraform Deploy<br/>• Infrastructure as Code<br/>• State management<br/>• Plan & Apply]
        
        Package[Lambda Packaging<br/>• ZIP creation<br/>• Dependency bundling<br/>• Layer optimization]
        
        Upload[Asset Upload<br/>• S3 sync<br/>• CloudFront invalidation<br/>• Version tagging]
    end
    
    subgraph "Environments"
        Dev[Development<br/>• Feature testing<br/>• Integration testing<br/>• Debugging]
        
        Staging[Staging<br/>• Pre-production<br/>• Performance testing<br/>• User acceptance]
        
        Prod[Production<br/>• Live environment<br/>• Monitoring<br/>• Rollback capability]
    end
    
    %% Flow
    GitHub --> Actions
    Actions --> Build
    Build --> Test
    Test --> Deploy
    Deploy --> Package
    Package --> Upload
    
    Upload --> Dev
    Dev --> Staging
    Staging --> Prod
    
    %% Feedback loops
    Test -.-> GitHub
    Deploy -.-> GitHub
    Prod -.-> GitHub
```

## Performance Architecture

### Caching Strategy

```mermaid
graph TB
    subgraph "Client-Side Caching"
        Browser[Browser Cache<br/>• Static assets<br/>• API responses<br/>• Service worker]
    end
    
    subgraph "CDN Caching"
        CloudFront[CloudFront Cache<br/>• Global edge locations<br/>• Dynamic content<br/>• API proxy caching]
    end
    
    subgraph "Application Caching"
        LRU[LRU Memory Cache<br/>• Lambda instance<br/>• Hot data<br/>• 100 items max]
        
        DynamoCache[DynamoDB Cache<br/>• Persistent cache<br/>• TTL cleanup<br/>• Cross-instance]
    end
    
    subgraph "Database Optimization"
        DynamoDB[DynamoDB<br/>• Single table design<br/>• Composite keys<br/>• GSI optimization]
        
        DAX[DynamoDB DAX<br/>• Microsecond latency<br/>• Automatic scaling<br/>• Optional enhancement]
    end
    
    %% Cache hierarchy
    Browser --> CloudFront
    CloudFront --> LRU
    LRU --> DynamoCache
    DynamoCache --> DynamoDB
    DynamoDB --> DAX
    
    %% Performance benefits
    Browser -.-> Fast[Fast: 0ms]
    CloudFront -.-> VeryFast[Very Fast: <50ms]
    LRU -.-> Fast2[Fast: <10ms]
    DynamoCache -.-> Medium[Medium: <100ms]
    DynamoDB -.-> Slow[Baseline: <500ms]
```
