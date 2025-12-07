# Documentation Technique - Backend Mobilisation Recettes Locales

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Diagramme de classes UML](#2-diagramme-de-classes-uml)
3. [Diagramme de paquetage UML](#3-diagramme-de-paquetage-uml)
4. [Diagrammes de séquence UML](#4-diagrammes-de-séquence-uml)
5. [Diagramme de composants UML](#5-diagramme-de-composants-uml)
6. [Diagramme de déploiement UML](#6-diagramme-de-déploiement-uml)
7. [Diagramme d'états UML](#7-diagramme-détats-uml)
8. [Diagramme d'activités UML](#8-diagramme-dactivités-uml)
9. [Technologies et dépendances](#9-technologies-et-dépendances)
10. [Base de données](#10-base-de-données)
11. [API REST](#11-api-rest)
12. [Sécurité](#12-sécurité)
13. [Performance et monitoring](#13-performance-et-monitoring)

---

## 1. Architecture générale

### 1.1 Vue d'ensemble

Le système est une plateforme de **prédiction et simulation de revenus fiscaux** pour les municipalités malgaches, basée sur :
- **Backend** : Express.js + TypeScript + TypeORM
- **Base de données** : PostgreSQL
- **IA** : Google Gemini API
- **ML** : TensorFlow.js (service Docker séparé)
- **Monitoring** : Prometheus + métriques personnalisées

### 1.2 Architecture en couches

```
┌─────────────────────────────────────────────────────────────┐
│                    Couche Présentation                       │
│                  (Controllers / Routers)                     │
│   ┌───────────┬───────────┬───────────┬───────────────┐   │
│   │ Revenue   │Simulation │Prediction │   AI/ML       │   │
│   │Controller │Controller │Controller │  Controller   │   │
│   └───────────┴───────────┴───────────┴───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Couche Métier                            │
│                   (Services / Logic)                         │
│   ┌───────────┬───────────┬───────────┬───────────────┐   │
│   │ Revenue   │Simulation │Prediction │   AI/ML       │   │
│   │ Service   │ Service   │ Service   │   Service     │   │
│   └───────────┴───────────┴───────────┴───────────────┘   │
│   ┌─────────────────────────────────────────────────┐     │
│   │  Optimization │ Backtest │ Validation Services  │     │
│   └─────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Couche Persistance                          │
│                 (Entities / Repositories)                    │
│   ┌───────────┬───────────┬───────────┬───────────────┐   │
│   │ Revenue   │Simulation │Prediction │RevenueValid.  │   │
│   │ Entity    │ Entity    │ Entity    │   Entity      │   │
│   └───────────┴───────────┴───────────┴───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Base de données                           │
│                      PostgreSQL                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Services externes

```
┌─────────────────────┐
│   Backend Express   │
└──────────┬──────────┘
           │
     ┌─────┴─────┬─────────────┬──────────────┬────────────┐
     │           │             │              │            │
     ▼           ▼             ▼              ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Gemini  │ │TensorFlow│ │Nominatim │ │Overpass  │ │Vault     │
│   API   │ │ Service  │ │   API    │ │   API    │ │(Secrets) │
└─────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 2. Diagramme de classes UML

### 2.1 Entités principales

```plantuml
@startuml

' ==================== ENTITÉS CORE ====================

class Simulation {
  - id: UUID
  - parameters: JSONB
  - weatherContext: JSONB
  - economicContext: JSONB
  - demographicContext: JSONB
  - status: string
  - municipalityId: string
  - createdAt: Date
  - updatedAt: Date
  --
  + create(): Simulation
  + update(params): void
}

class Revenue {
  - id: UUID
  - date: Date
  - amount: Decimal(12,2)
  - source: string
  - name: string
  - parameters: JSONB
  - municipalityId: string
  - createdAt: Date
  - updatedAt: Date
  --
  + calculateTotal(): number
  + filterByPeriod(start, end): Revenue[]
}

class Prediction {
  - id: UUID
  - revenueId: UUID
  - predictedDate: Date
  - predictedAmount: Decimal(12,2)
  - model: string
  - lowerBound: Decimal
  - upperBound: Decimal
  - confidenceLevel: number
  - period: string
  - municipalityId: string
  - createdAt: Date
  - updatedAt: Date
  --
  + calculateConfidenceInterval(): [number, number]
  + validate(): boolean
}

class RevenueValidation {
  - id: UUID
  - originalName: string
  - normalizedName: string
  - description: text
  - municipalityId: string
  - status: enum
  - pcopReference: JSONB
  - legalReference: JSONB
  - revenueType: string
  - assiette: text
  - taux: text
  - modalitesRecouvrement: text
  - conditionsApplication: text
  - observations: text
  - rawAiResponse: JSONB
  - createdBy: string
  - createdAt: Date
  - updatedAt: Date
  --
  + validate(): boolean
  + normalize(): string
}

' ==================== ENTITÉS MÉTIER ====================

class BacktestResult {
  - id: UUID
  - modelName: string
  - metrics: JSONB
  - actualValues: JSONB
  - predictedValues: JSONB
  - startDate: Date
  - endDate: Date
  - createdAt: Date
  --
  + calculateRMSE(): number
  + calculateMAE(): number
  + calculateMAPE(): number
}

class TrainedModel {
  - id: UUID
  - modelName: string
  - modelType: string
  - version: string
  - hyperparameters: JSONB
  - metrics: JSONB
  - modelPath: string
  - status: string
  - createdAt: Date
  - updatedAt: Date
  --
  + deploy(): void
  + rollback(): void
}

class LabeledDataset {
  - id: UUID
  - features: JSONB
  - target: number
  - label: string
  - source: string
  - municipalityId: string
  - createdAt: Date
  --
  + split(ratio): [LabeledDataset[], LabeledDataset[]]
}

class AnalysisResult {
  - id: UUID
  - simulationId: UUID
  - interpretation: text
  - recommendations: JSONB
  - risks: JSONB
  - confidence: number
  - modelUsed: string
  - createdAt: Date
  --
  + summarize(): string
  + exportPDF(): Buffer
}

' ==================== CONTEXTES ====================

class EconomicIndicator {
  - id: UUID
  - municipalityId: string
  - indicator: string
  - value: number
  - date: Date
  - source: string
  - createdAt: Date
  --
  + normalize(): number
  + compare(other): number
}

class WeatherContext {
  - id: UUID
  - municipalityId: string
  - date: Date
  - temperature: number
  - rainfall: number
  - season: string
  - createdAt: Date
  --
  + getSeason(): string
}

class Demographic {
  - id: UUID
  - municipalityId: string
  - population: number
  - growthRate: number
  - year: number
  - createdAt: Date
  --
  + projectPopulation(year): number
}

class Market {
  - id: UUID
  - name: string
  - type: string
  - city: string
  - coordinates: JSONB
  - operatingDays: JSONB
  - vendorCount: number
  - revenueEstimate: Decimal
  - createdAt: Date
  --
  + isOperating(date): boolean
  + estimateRevenue(season): number
}

' ==================== MONITORING ====================

class DriftAlert {
  - id: UUID
  - modelName: string
  - metricName: string
  - threshold: number
  - actualValue: number
  - severity: string
  - detectedAt: Date
  - resolvedAt: Date
  --
  + notify(): void
  + resolve(): void
}

class AuditLog {
  - id: UUID
  - userId: string
  - action: string
  - resource: string
  - details: JSONB
  - timestamp: Date
  --
  + search(criteria): AuditLog[]
}

class ProductionPrediction {
  - id: UUID
  - modelVersion: string
  - inputData: JSONB
  - outputData: JSONB
  - latency: number
  - timestamp: Date
  --
  + track(): void
}

' ==================== INTÉGRATIONS ====================

class SecretAccess {
  - id: UUID
  - secretPath: string
  - accessedBy: string
  - accessedAt: Date
  - success: boolean
  --
  + log(): void
}

' ==================== RELATIONS ====================

Simulation "1" -- "0..*" Prediction : generates
Simulation "1" -- "0..*" AnalysisResult : produces
Revenue "1" -- "0..*" Prediction : predicts
Simulation "0..*" -- "0..*" Market : uses
Simulation "0..*" -- "1" WeatherContext : requires
Simulation "0..*" -- "1" EconomicIndicator : requires
Simulation "0..*" -- "1" Demographic : requires
TrainedModel "1" -- "0..*" BacktestResult : evaluates
TrainedModel "1" -- "0..*" ProductionPrediction : produces
LabeledDataset "0..*" -- "1" TrainedModel : trains
DriftAlert "0..*" -- "1" TrainedModel : monitors

@enduml
```

### 2.2 Services et contrôleurs

```plantuml
@startuml

' ==================== SERVICES ====================

class SimulationService {
  - repository: Repository<Simulation>
  - contextService: ContextService
  - aiService: AIService
  --
  + createSimulation(params): Promise<Simulation>
  + getSimulations(filters): Promise<Simulation[]>
  + enrichWithContexts(sim): Promise<Simulation>
}

class PredictionService {
  - repository: Repository<Prediction>
  - tensorflowClient: TensorFlowClient
  --
  + applyPredictionMethods(sim, contexts): Promise<PredictionResult>
  + linearRegression(data): number
  + neuralNetworkPrediction(data): Promise<number>
  + seasonalAnalysis(data): number
}

class AIService {
  - geminiClient: GoogleGenAI
  - cache: NodeCache
  --
  + enrichAnalysis(sim, predictions): Promise<AnalysisResult>
  + callGemini(prompt): Promise<string>
  + parseStructuredResponse(text): JSONB
}

class RevenueValidationService {
  - repository: Repository<RevenueValidation>
  - aiService: AIService
  --
  + validateRevenue(name, municipalityId): Promise<ValidationResult>
  + normalizeRevenueName(name): string
  + extractLegalReferences(text): JSONB
}

class BacktestService {
  - repository: Repository<BacktestResult>
  - predictionService: PredictionService
  --
  + runBacktest(modelName, period): Promise<BacktestResult>
  + calculateMetrics(actual, predicted): JSONB
}

class TrainingService {
  - repository: Repository<TrainedModel>
  - dataLabelingService: DataLabelingService
  --
  + trainModel(config): Promise<TrainedModel>
  + deployModel(modelId): void
  + rollbackModel(modelId): void
}

class ContextService {
  - economicRepo: Repository<EconomicIndicator>
  - weatherRepo: Repository<WeatherContext>
  - demographicRepo: Repository<Demographic>
  --
  + getContextsByCity(city): Promise<Contexts>
  + enrichContext(city): Promise<void>
}

class OptimizerService {
  - simulationService: SimulationService
  --
  + optimizeScenario(params): Promise<OptimizationResult>
  + findBestParameters(constraints): JSONB
}

class MetricsService {
  - prometheusRegistry: Registry
  --
  + recordPrediction(duration, model): void
  + getMetrics(): string
}

class DriftDetectorService {
  - repository: Repository<DriftAlert>
  - metricsService: MetricsService
  --
  + detectDrift(model, metrics): Promise<DriftAlert[]>
  + alertIfThresholdExceeded(value, threshold): void
}

' ==================== CONTROLLERS ====================

class SimulationController {
  - service: SimulationService
  --
  + POST /simulations
  + GET /simulations
  + GET /simulations/:id
  + DELETE /simulations/:id
}

class PredictionController {
  - service: PredictionService
  --
  + POST /predictions
  + GET /predictions
  + GET /predictions/:id
}

class RevenueValidationController {
  - service: RevenueValidationService
  --
  + POST /revenue-validation
  + GET /revenue-validation/history
  + GET /revenue-validation/:id
}

class AIController {
  - service: AIService
  --
  + POST /analysis/:id/enrich
  + GET /analysis/:id
}

class BacktestController {
  - service: BacktestService
  --
  + POST /backtest/run
  + GET /backtest/results
}

class TrainingController {
  - service: TrainingService
  --
  + POST /training/train
  + POST /training/deploy/:id
  + GET /training/models
}

class MetricsController {
  - service: MetricsService
  --
  + GET /metrics
}

class DriftController {
  - service: DriftDetectorService
  --
  + GET /drift/alerts
  + POST /drift/resolve/:id
}

' ==================== RELATIONS ====================

SimulationController --> SimulationService : uses
PredictionController --> PredictionService : uses
RevenueValidationController --> RevenueValidationService : uses
AIController --> AIService : uses
BacktestController --> BacktestService : uses
TrainingController --> TrainingService : uses
MetricsController --> MetricsService : uses
DriftController --> DriftDetectorService : uses

SimulationService --> ContextService : uses
SimulationService --> AIService : uses
PredictionService --> TensorFlowClient : uses
AIService --> GoogleGenAI : uses
BacktestService --> PredictionService : uses
TrainingService --> DataLabelingService : uses

@enduml
```

---

## 3. Diagramme de paquetage UML

```plantuml
@startuml

package "Backend Application" {
  
  package "api" <<Rectangle>> {
    package "controllers" {
      [SimulationController]
      [PredictionController]
      [RevenueValidationController]
      [AIController]
      [BacktestController]
      [TrainingController]
      [MetricsController]
    }
    
    package "middleware" {
      [ErrorHandler]
      [CorsMiddleware]
      [LoggingMiddleware]
    }
    
    package "dto" {
      [CreateSimulationDto]
      [PredictionResultDto]
      [ValidationRequestDto]
    }
  }
  
  package "core" <<Rectangle>> {
    package "services" {
      [SimulationService]
      [PredictionService]
      [RevenueValidationService]
      [AIService]
      [BacktestService]
      [TrainingService]
      [ContextService]
      [OptimizerService]
    }
    
    package "entities" {
      [Simulation]
      [Prediction]
      [Revenue]
      [RevenueValidation]
      [BacktestResult]
      [TrainedModel]
    }
    
    package "repositories" {
      [TypeORMRepository]
    }
  }
  
  package "ai" <<Rectangle>> {
    [AIService]
    [LLMParser]
    [PredictionMethods]
    [TensorFlowClient]
    [Queue]
  }
  
  package "integrations" <<Rectangle>> {
    [NominatimService]
    [OverpassService]
    [TransactionService]
    [PlaceService]
  }
  
  package "monitoring" <<Rectangle>> {
    [MetricsService]
    [DriftDetectorService]
    [PrometheusRegistry]
  }
  
  package "etl" <<Rectangle>> {
    [DataLabelingService]
    [PipelineService]
  }
  
  package "mlflow" <<Rectangle>> {
    [ModelRegistryService]
  }
  
  package "secrets" <<Rectangle>> {
    [VaultService]
  }
  
  package "optimization" <<Rectangle>> {
    [OptimizerService]
  }
  
  package "utils" <<Rectangle>> {
    [Validators]
    [Formatters]
    [Constants]
  }
}

package "External Services" {
  [PostgreSQL]
  [Redis]
  [TensorFlowService]
  [GeminiAPI]
  [NominatimAPI]
  [OverpassAPI]
  [Vault]
  [Prometheus]
}

' Dépendances entre paquets
controllers --> services : uses
controllers --> dto : uses
controllers --> middleware : uses

services --> entities : manipulates
services --> repositories : uses
services --> ai : uses
services --> integrations : uses
services --> monitoring : uses
services --> utils : uses

ai --> [TensorFlowService] : calls
ai --> [GeminiAPI] : calls
integrations --> [NominatimAPI] : calls
integrations --> [OverpassAPI] : calls
repositories --> [PostgreSQL] : persists
secrets --> [Vault] : retrieves
monitoring --> [Prometheus] : exports
ai --> [Redis] : caches

@enduml
```

---

## 4. Diagrammes de séquence UML

### 4.1 Création et enrichissement d'une simulation

```plantuml
@startuml

actor User
participant "SimulationController" as SC
participant "SimulationService" as SS
participant "ContextService" as CS
participant "PredictionService" as PS
participant "AIService" as AI
participant "Database" as DB
participant "TensorFlow" as TF
participant "Gemini API" as Gemini

User -> SC: POST /simulations\n{params, municipalityId}
activate SC

SC -> SS: createSimulation(params)
activate SS

SS -> CS: getContextsByCity(municipalityId)
activate CS
CS -> DB: SELECT contexts WHERE city=...
DB --> CS: contexts data
CS --> SS: {weather, economic, demographic}
deactivate CS

SS -> DB: INSERT INTO simulation
DB --> SS: simulation.id
SS --> SC: simulation created
deactivate SS

SC --> User: 201 Created {simulationId}
deactivate SC

... Enrichissement asynchrone ...

User -> SC: POST /analysis/:id/enrich
activate SC

SC -> AI: enrichAnalysis(simulationId)
activate AI

AI -> DB: SELECT simulation WHERE id=...
DB --> AI: simulation data

AI -> PS: applyPredictionMethods(simulation)
activate PS

' Méthode 1: Régression linéaire
PS -> PS: linearRegression()

' Méthode 2: Réseau de neurones
PS -> TF: POST /predict\n{features, trainingData}
activate TF
TF -> TF: train model
TF -> TF: predict
TF --> PS: prediction result
deactivate TF

' Méthode 3: Analyse saisonnière
PS -> PS: seasonalAnalysis()

PS --> AI: {linear, neural, seasonal}
deactivate PS

AI -> AI: buildPrompt(predictions, contexts)

AI -> Gemini: POST /generate\n{prompt, model}
activate Gemini
Gemini -> Gemini: analyze
Gemini --> AI: structured response
deactivate Gemini

AI -> AI: parseResponse()
AI -> DB: INSERT INTO analysis_result
DB --> AI: result.id

AI --> SC: {interpretation, recommendations, confidence}
deactivate AI

SC --> User: 200 OK {enriched analysis}
deactivate SC

@enduml
```

### 4.2 Validation de recette fiscale

```plantuml
@startuml

actor User
participant "RevenueValidationController" as RVC
participant "RevenueValidationService" as RVS
participant "AIService" as AI
participant "Database" as DB
participant "Gemini API" as Gemini

User -> RVC: POST /revenue-validation\n{originalName, municipalityId}
activate RVC

RVC -> RVS: validateRevenue(request)
activate RVS

RVS -> RVS: checkCache(originalName)
alt Cache hit
  RVS --> RVC: cached result
else Cache miss
  
  RVS -> AI: callGemini(validationPrompt)
  activate AI
  
  AI -> Gemini: POST /generate\n{prompt: "Validez cette recette..."}
  activate Gemini
  
  Gemini -> Gemini: Analyze against PCOP 2006\nand Tax Code LFI 2025
  
  Gemini --> AI: JSON response\n{name, description, legal_refs}
  deactivate Gemini
  
  AI -> AI: parseStructuredResponse()
  AI --> RVS: parsed validation result
  deactivate AI
  
  RVS -> RVS: determineStatus(result)
  
  RVS -> DB: INSERT INTO revenue_validation\n{originalName, normalizedName, status...}
  activate DB
  DB --> RVS: validation.id
  deactivate DB
  
  RVS -> RVS: cacheResult(originalName, result)
  
  RVS --> RVC: {name, status, description, municipality_id}
end

deactivate RVS

RVC --> User: 200 OK\n{name, status, description}
deactivate RVC

@enduml
```

### 4.3 Backtest d'un modèle

```plantuml
@startuml

actor Developer
participant "BacktestController" as BC
participant "BacktestService" as BS
participant "PredictionService" as PS
participant "Database" as DB

Developer -> BC: POST /backtest/run\n{modelName, startDate, endDate}
activate BC

BC -> BS: runBacktest(modelName, period)
activate BS

BS -> DB: SELECT actual_revenues\nWHERE date BETWEEN...
activate DB
DB --> BS: historical data
deactivate DB

loop For each data point
  BS -> PS: predict(features, modelName)
  activate PS
  PS -> PS: applyModel(features)
  PS --> BS: predicted value
  deactivate PS
end

BS -> BS: calculateMetrics(actual, predicted)
note right
  - RMSE
  - MAE
  - MAPE
  - R²
end note

BS -> DB: INSERT INTO backtest_result\n{metrics, actual, predicted}
activate DB
DB --> BS: backtest.id
deactivate DB

BS --> BC: {id, metrics, visualizations}
deactivate BS

BC --> Developer: 200 OK\n{backtest results}
deactivate BC

@enduml
```

### 4.4 Entraînement et déploiement de modèle

```plantuml
@startuml

actor DataScientist
participant "TrainingController" as TC
participant "TrainingService" as TS
participant "DataLabelingService" as DLS
participant "TensorFlow" as TF
participant "ModelRegistry" as MR
participant "Database" as DB

DataScientist -> TC: POST /training/train\n{config, hyperparameters}
activate TC

TC -> TS: trainModel(config)
activate TS

TS -> DLS: getTrainingDataset()
activate DLS
DLS -> DB: SELECT labeled_data
DB --> DLS: dataset
DLS -> DLS: split(train=0.8, test=0.2)
DLS --> TS: {train_data, test_data}
deactivate DLS

TS -> TF: trainModel(train_data, config)
activate TF
TF -> TF: build neural network
TF -> TF: train epochs
TF -> TF: evaluate on test set
TF --> TS: {model, metrics}
deactivate TF

TS -> MR: registerModel(model, metrics)
activate MR
MR -> MR: save model artifact
MR -> MR: log experiment to MLflow
MR --> TS: model_version
deactivate MR

TS -> DB: INSERT INTO trained_model\n{name, version, metrics, status='staged'}
DB --> TS: model.id

TS --> TC: {modelId, metrics, status}
deactivate TS

TC --> DataScientist: 201 Created\n{model details}
deactivate TC

... Validation manuelle ...

DataScientist -> TC: POST /training/deploy/:id
activate TC

TC -> TS: deployModel(modelId)
activate TS

TS -> DB: UPDATE trained_model\nSET status='production'
TS -> MR: transitionModelStage('production')
activate MR
MR --> TS: success
deactivate MR

TS --> TC: deployment complete
deactivate TS

TC --> DataScientist: 200 OK {deployed}
deactivate TC

@enduml
```

---

## 5. Diagramme de composants UML

```plantuml
@startuml

' ==================== COMPOSANTS PRINCIPAUX ====================

component "Express Application" {
  
  [API Gateway] as Gateway
  
  component "Controllers Layer" {
    [Revenue Controller]
    [Simulation Controller]
    [Prediction Controller]
    [Validation Controller]
    [AI Controller]
    [Training Controller]
    [Backtest Controller]
    [Metrics Controller]
  }
  
  component "Services Layer" {
    [Revenue Service]
    [Simulation Service]
    [Prediction Service]
    [Validation Service]
    [AI Service]
    [Training Service]
    [Backtest Service]
    [Context Service]
    [Optimizer Service]
  }
  
  component "Data Layer" {
    [TypeORM DataSource]
    [Repositories]
    [Entities]
  }
  
  component "Middleware" {
    [CORS Middleware]
    [Error Handler]
    [Logger (Morgan)]
  }
}

component "AI/ML Components" {
  [TensorFlow Client]
  [Prediction Methods]
  [LLM Parser]
  [BullMQ Queue]
}

component "Integration Components" {
  [Nominatim Client]
  [Overpass Client]
  [Place Service]
  [Transaction Service]
}

component "Monitoring Components" {
  [Prometheus Client]
  [Metrics Collector]
  [Drift Detector]
}

component "ETL Components" {
  [Data Labeling Service]
  [Pipeline Service]
}

' ==================== SERVICES EXTERNES ====================

database "PostgreSQL" {
  [Revenue Table]
  [Simulation Table]
  [Prediction Table]
  [Validation Table]
  [Model Table]
}

component "TensorFlow Service\n(Docker)" {
  [HTTP Server :8501]
  [TensorFlow.js Engine]
  [Model Cache]
}

cloud "Google Gemini API" {
  [gemini-2.0-flash]
}

cloud "OpenStreetMap Services" {
  [Nominatim API]
  [Overpass API]
}

component "HashiCorp Vault" {
  [Secret Storage]
}

component "Redis" {
  [Cache]
  [Queue Storage]
}

component "MLflow Server" {
  [Model Registry]
  [Experiment Tracking]
}

component "Prometheus" {
  [Metrics Storage]
  [Alerting]
}

' ==================== CONNEXIONS ====================

Gateway --> [Controllers Layer] : routes
[Controllers Layer] --> [Services Layer] : calls
[Services Layer] --> [Data Layer] : persists
[Services Layer] --> [AI/ML Components] : uses
[Services Layer] --> [Integration Components] : uses
[Services Layer] --> [Monitoring Components] : tracks

[Data Layer] --> PostgreSQL : queries
[TensorFlow Client] --> [TensorFlow Service\n(Docker)] : HTTP
[AI Service] --> [Google Gemini API] : API calls
[Integration Components] --> [OpenStreetMap Services] : API calls
[BullMQ Queue] --> Redis : stores jobs
[AI Service] --> Redis : caches responses
[Monitoring Components] --> Prometheus : exports
[Training Service] --> [MLflow Server] : logs experiments
[Services Layer] --> [HashiCorp Vault] : retrieves secrets

@enduml
```

---

## 6. Diagramme de déploiement UML

```plantuml
@startuml

node "Application Server" {
  artifact "backend.js" {
    component "Express.js\nApplication"
  }
  
  artifact "node_modules" {
    component "Dependencies"
  }
  
  component "Node.js Runtime\nv18+"
}

node "Database Server" {
  database "PostgreSQL 14+" {
    storage "revenues"
    storage "simulations"
    storage "predictions"
    storage "validations"
    storage "trained_models"
  }
}

node "ML Service Container\n(Docker)" {
  artifact "tensorflow-service" {
    component "TensorFlow.js\nService"
    component "Express Server\n:8501"
  }
}

node "Cache Server" {
  component "Redis 7.x" {
    storage "AI Response Cache"
    storage "Job Queue"
  }
}

node "Secret Management" {
  component "HashiCorp Vault" {
    storage "API Keys"
    storage "DB Credentials"
  }
}

node "Monitoring Server" {
  component "Prometheus" {
    storage "Metrics DB"
  }
  
  component "Grafana" {
    artifact "Dashboards"
  }
}

node "ML Tracking" {
  component "MLflow Server" {
    storage "Experiments"
    storage "Model Registry"
    storage "Artifacts"
  }
}

cloud "External APIs" {
  component "Google Gemini API\n(gemini-2.0-flash)"
  component "Nominatim API\n(OSM)"
  component "Overpass API\n(OSM)"
}

' ==================== CONNEXIONS ====================

[Express.js\nApplication] --> PostgreSQL : TypeORM\nTCP:5432
[Express.js\nApplication] --> [TensorFlow.js\nService] : HTTP REST\nTCP:8501
[Express.js\nApplication] --> Redis : ioredis\nTCP:6379
[Express.js\nApplication] --> [Google Gemini API\n(gemini-2.0-flash)] : HTTPS\nAPI calls
[Express.js\nApplication] --> [Nominatim API\n(OSM)] : HTTPS
[Express.js\nApplication] --> [Overpass API\n(OSM)] : HTTPS
[Express.js\nApplication] --> Prometheus : /metrics\nHTTP:9090
[Express.js\nApplication] --> [MLflow Server] : HTTP:5000
[Express.js\nApplication] --> [HashiCorp Vault] : HTTPS\nAPI

Grafana --> Prometheus : Query

note right of [Application Server]
  Environment: Node.js
  Port: 3000
  Protocol: HTTP/REST
  Deployment: PM2 / Docker
end note

note right of [ML Service Container\n(Docker)]
  Image: tensorflow-prediction-service
  Port: 8501
  CPU: 0.5 vCPU
  Memory: 256MB
end note

note right of [Database Server]
  Backup: Daily
  Replication: Master-Slave
  Connection Pool: 20
end note

@enduml
```

---

## 7. Diagramme d'états UML

### 7.1 États d'une Simulation

```plantuml
@startuml

[*] --> Pending : createSimulation()

Pending --> Running : startProcessing()
Pending --> Failed : validationError()

Running --> AwaitingContexts : fetchContexts()
AwaitingContexts --> Running : contextsReceived()
AwaitingContexts --> Failed : contextsNotFound()

Running --> AwaitingPredictions : applyMethods()
AwaitingPredictions --> Running : predictionsComplete()
AwaitingPredictions --> Failed : predictionError()

Running --> AwaitingAIAnalysis : callGemini()
AwaitingAIAnalysis --> Completed : analysisComplete()
AwaitingAIAnalysis --> Failed : geminiError()

Completed --> Archived : archive(30days)
Failed --> Pending : retry()

Archived --> [*]
Failed --> [*] : cleanup()

@enduml
```

### 7.2 États d'un Modèle Entraîné

```plantuml
@startuml

[*] --> Training : startTraining()

Training --> Validating : trainingComplete()
Training --> Failed : trainingError()

Validating --> Staged : metricsAcceptable()
Validating --> Failed : metricsRejected()

Staged --> Production : deploy()
Staged --> Archived : reject()

Production --> Monitoring : activateMonitoring()
Monitoring --> Production : metricsHealthy()
Monitoring --> Degraded : driftDetected()

Degraded --> Production : resolveIssue()
Degraded --> Rollback : criticalDrift()

Rollback --> Production : restorePreviousVersion()

Production --> Archived : newVersionDeployed()
Failed --> [*] : cleanup()
Archived --> [*]

@enduml
```

### 7.3 États d'une Validation de Recette

```plantuml
@startuml

[*] --> Pending : submitValidation()

Pending --> Processing : callAI()

Processing --> Valid : nameNormalized()\n& referencesFound()
Processing --> Invalid : noMatchFound()\n& errorReturned()
Processing --> Ambiguous : multipleMatches()
Processing --> Error : aiCallFailed()

Valid --> Completed : saveResult()
Invalid --> Completed : saveResult()
Ambiguous --> ManualReview : flagForReview()
Error --> Pending : retry()

ManualReview --> Valid : userConfirmed()
ManualReview --> Invalid : userRejected()

Completed --> [*]

note right of Valid
  status = "valid"
  normalizedName filled
  references complete
end note

note right of Invalid
  status = "invalid"
  normalizedName = null
  description contains error
end note

note right of Ambiguous
  status = "ambiguous"
  normalizedName = null
  description lists options
end note

@enduml
```

---

## 8. Diagramme d'activités UML

### 8.1 Processus de prédiction quantitative

```plantuml
@startuml

start

:Recevoir requête simulation;

:Valider paramètres d'entrée;

if (Paramètres valides ?) then (oui)
  
  :Créer simulation en BDD;
  
  fork
    :Récupérer contextes\néconomiques;
  fork again
    :Récupérer contextes\nmétéorologiques;
  fork again
    :Récupérer contextes\ndémographiques;
  end fork
  
  if (Tous contextes disponibles ?) then (non)
    :Enrichir contextes manquants\n(APIs externes);
  else (oui)
    :Continuer;
  endif
  
  partition "Méthodes de prédiction (parallèle)" {
    fork
      :Méthode 1:\nRégression linéaire;
      :Calculer trend\n(population × PIB × temps);
      :result_linear;
    fork again
      :Méthode 2:\nRéseau de neurones;
      :Appeler TensorFlow service;
      :Entraîner modèle ad-hoc;
      :Générer prédiction;
      :result_neural;
    fork again
      :Méthode 3:\nAnalyse saisonnière;
      :Calculer moyennes mobiles;
      :Appliquer facteurs saisonniers;
      :result_seasonal;
    end fork
  }
  
  :Agréger résultats\n{linear, neural, seasonal};
  
  :Construire prompt IA enrichi;
  
  :Appeler Gemini API;
  
  :Parser réponse structurée;
  
  :Sauvegarder analyse enrichie;
  
  :Calculer confiance globale;
  
  :Retourner résultat JSON;
  
  stop
  
else (non)
  :Retourner erreur 400;
  stop
endif

@enduml
```

### 8.2 Pipeline ETL de labelling de données

```plantuml
@startuml

start

:Déclencher pipeline ETL;

:Charger données brutes\n(CSV / DB);

partition "Nettoyage" {
  :Supprimer doublons;
  :Corriger valeurs manquantes;
  :Normaliser formats dates;
  :Valider cohérence;
}

partition "Transformation" {
  :Extraire features\n(population, saison, type recette);
  :Calculer variables dérivées\n(growth_rate, ratio);
  :Encoder variables catégorielles;
  :Normaliser échelles numériques;
}

partition "Labelling" {
  fork
    :Labelling automatique\n(règles métier);
  fork again
    :Labelling assisté IA\n(Gemini);
  fork again
    :Labelling manuel\n(admin);
  end fork
  
  :Consolider labels;
}

partition "Validation" {
  if (Qualité acceptable ?) then (oui)
    :Marquer dataset validé;
  else (non)
    :Signaler anomalies;
    :Retour nettoyage;
    stop
  endif
}

:Sauvegarder labeled_dataset;

:Calculer statistiques;

:Notifier disponibilité;

stop

@enduml
```

### 8.3 Workflow de déploiement de modèle

```plantuml
@startuml

start

:Data Scientist crée\nnouveau modèle;

:Entraîner modèle localement;

:Soumettre via API\nPOST /training/train;

partition "Entraînement automatique" {
  :Charger dataset labelé;
  
  :Split train/test (80/20);
  
  :Entraîner modèle;
  
  :Évaluer sur test set;
  
  :Calculer métriques\n(RMSE, MAE, R²);
}

if (Métriques > seuil ?) then (oui)
  
  :Sauvegarder modèle\nstatus='staged';
  
  :Logger expérience MLflow;
  
  :Notifier Data Scientist;
  
  --> Validation manuelle
  
  if (Approbation ?) then (oui)
    
    :Déployer en production\nPOST /training/deploy/:id;
    
    fork
      :Activer monitoring drift;
    fork again
      :Désactiver ancien modèle;
    fork again
      :Router traffic vers nouveau;
    end fork
    
    :Enregistrer audit log;
    
    stop
    
  else (non)
    :Archiver modèle;
    stop
  endif
  
else (non)
  :Marquer échec;
  :Analyser logs;
  stop
endif

@enduml
```

---

## 9. Technologies et dépendances

### 9.1 Stack technologique

| Catégorie | Technologie | Version | Rôle |
|-----------|-------------|---------|------|
| **Runtime** | Node.js | 18+ | Environnement d'exécution |
| **Langage** | TypeScript | 5.x | Langage principal |
| **Framework Web** | Express.js | 4.18+ | Serveur HTTP REST |
| **ORM** | TypeORM | 0.3+ | Mapping objet-relationnel |
| **Base de données** | PostgreSQL | 14+ | Stockage relationnel |
| **Cache** | Redis | 7.x | Cache distribué + queue |
| **IA** | Google Gemini | 2.0-flash | Analyse intelligente |
| **ML** | TensorFlow.js | 4.x | Prédictions quantitatives |
| **Monitoring** | Prometheus | 2.x | Métriques applicatives |
| **Secrets** | HashiCorp Vault | 1.x | Gestion secrets |
| **ML Tracking** | MLflow | 2.x | Suivi expériences ML |
| **Queue** | BullMQ | 5.x | Tâches asynchrones |
| **Documentation** | Swagger/OpenAPI | 3.0 | Documentation API |

### 9.2 Dépendances NPM principales

```json
{
  "dependencies": {
    "@google/genai": "^1.30.0",
    "@nestjs/bullmq": "^11.0.4",
    "axios": "^1.4.0",
    "bullmq": "^5.63.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "morgan": "^1.10.0",
    "node-cache": "^5.1.2",
    "node-vault": "^0.10.9",
    "pg": "^8.0.0",
    "prom-client": "^15.1.3",
    "reflect-metadata": "^0.1.13",
    "swagger-ui-express": "^5.0.0",
    "typeorm": "^0.3.20"
  }
}
```

---

## 10. Base de données

### 10.1 Schéma relationnel

```sql
-- Tables principales
CREATE TABLE simulation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameters JSONB,
  weather_context JSONB,
  economic_context JSONB,
  demographic_context JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  municipality_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  source VARCHAR(255),
  name VARCHAR(255),
  parameters JSONB,
  municipality_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prediction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_id UUID REFERENCES revenue(id),
  predicted_date DATE NOT NULL,
  predicted_amount NUMERIC(12, 2) NOT NULL,
  model VARCHAR(100),
  lower_bound NUMERIC(12, 2),
  upper_bound NUMERIC(12, 2),
  confidence_level NUMERIC(5, 2),
  period VARCHAR(50),
  municipality_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE revenue_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255),
  description TEXT,
  municipality_id VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  pcop_reference JSONB,
  legal_reference JSONB,
  revenue_type VARCHAR(100),
  assiette TEXT,
  taux TEXT,
  modalites_recouvrement TEXT,
  conditions_application TEXT,
  observations TEXT,
  raw_ai_response JSONB,
  created_by VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimisation
CREATE INDEX idx_simulation_municipality ON simulation(municipality_id);
CREATE INDEX idx_simulation_status ON simulation(status);
CREATE INDEX idx_revenue_date ON revenue(date);
CREATE INDEX idx_revenue_municipality ON revenue(municipality_id);
CREATE INDEX idx_prediction_date ON prediction(predicted_date);
CREATE INDEX idx_validation_original_name ON revenue_validation(original_name);
CREATE INDEX idx_validation_status ON revenue_validation(status);
```

### 10.2 Modèle de données JSONB

**Simulation.parameters** :
```json
{
  "city": "Antananarivo",
  "recipe_types": ["IFPB", "taxe_marché"],
  "seasons": ["dry", "wet"],
  "horizon": 12,
  "scenarios": ["optimistic", "pessimistic"]
}
```

**Simulation.weatherContext** :
```json
{
  "season": "dry",
  "avgTemperature": 22.5,
  "avgRainfall": 45.2,
  "extremeEvents": []
}
```

**RevenueValidation.pcopReference** :
```json
{
  "classe": "6",
  "chapitre": "601",
  "compte": "6011",
  "rubrique": "Impôts directs locaux"
}
```

---

## 11. API REST

### 11.1 Structure des endpoints

**Base URL** : `/serviceprediction`

| Groupe | Endpoints | Méthodes | Description |
|--------|-----------|----------|-------------|
| **Revenu** | `/revenues` | GET, POST | Gestion des revenus historiques |
| **Simulation** | `/simulations` | GET, POST, DELETE | Création et gestion simulations |
| **Prédiction** | `/predictions` | GET, POST | Prédictions quantitatives |
| **Validation** | `/revenue-validation` | GET, POST | Validation recettes fiscales |
| **Analyse IA** | `/analysis/:id/enrich` | POST | Enrichissement IA |
| **Optimisation** | `/optimize` | POST | Optimisation scénarios |
| **Backtest** | `/backtest/run` | POST | Tests de régression |
| **Entraînement** | `/training/train` | POST | Entraînement modèles |
| **Métriques** | `/metrics` | GET | Export Prometheus |

### 11.2 Exemples de requêtes/réponses

**POST /serviceprediction/simulations**
```json
{
  "parameters": {
    "city": "Antananarivo",
    "recipe_types": ["IFPB"],
    "horizon": 6
  },
  "weatherContext": {...},
  "economicContext": {...}
}
```

Réponse :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "createdAt": "2025-12-03T10:30:00Z"
}
```

**POST /serviceprediction/revenue-validation**
```json
{
  "original_name": "Taxe marché",
  "municipality_id": "antananarivo-001"
}
```

Réponse :
```json
{
  "name": "Redevances d'occupation des halles et marchés communaux",
  "status": "valid",
  "description": "- Base légale : Code Général...",
  "municipality_id": "antananarivo-001"
}
```

---

## 12. Sécurité

### 12.1 Stratégies de sécurité

| Aspect | Mécanisme | Implémentation |
|--------|-----------|----------------|
| **Authentification** | Désactivée (API publique) | Aucune |
| **CORS** | Configurable | `CORS_ORIGIN` env var |
| **Secrets** | HashiCorp Vault | Centralisé |
| **Validation** | Express validators | DTOs TypeScript |
| **Rate limiting** | Non implémenté | À ajouter |
| **SQL Injection** | TypeORM paramétrisé | Protection native |
| **XSS** | JSON strict | Pas de HTML |

### 12.2 Variables d'environnement sensibles

```bash
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/mobilisation

# APIs externes
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...

# Vault
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=s.xxx...

# Redis
REDIS_URL=redis://localhost:6379
```

---

## 13. Performance et monitoring

### 13.1 Métriques Prometheus

Métriques exposées sur `/metrics` :

```
# Prédictions
prediction_duration_seconds{model="linear|neural|seasonal"}
prediction_total{status="success|error"}
prediction_confidence{model="..."}

# API
http_request_duration_seconds{route="...", method="...", status="..."}
http_requests_total{...}

# Base de données
db_query_duration_seconds{operation="select|insert|update"}
db_connections_active
db_connections_idle

# IA
ai_call_duration_seconds{provider="gemini|openai"}
ai_tokens_used{provider="..."}
ai_cache_hit_ratio

# Drift
model_drift_detected_total{model="..."}
model_prediction_latency_seconds
```

### 13.2 Optimisations

- **Cache Redis** : Réponses IA (TTL 1h)
- **Connection pooling** : PostgreSQL (max 20)
- **Index BDD** : Sur `municipality_id`, `date`, `status`
- **JSONB** : Pour flexibilité sans overhead
- **Lazy loading** : Contextes chargés à la demande
- **Batch processing** : BullMQ pour tâches lourdes

---

## Annexes

### A. Glossaire technique

| Terme | Définition |
|-------|------------|
| **PCOP** | Plan Comptable des Organismes Publics (2006 CTD) |
| **LFI** | Loi de Finances Initiale (2025 pour Tax Code) |
| **IFPB** | Impôt Foncier sur la Propriété Bâtie |
| **RMSE** | Root Mean Square Error (métrique ML) |
| **MAE** | Mean Absolute Error |
| **MAPE** | Mean Absolute Percentage Error |
| **Drift** | Dégradation performance modèle ML |

### B. Références

- Documentation TypeORM : https://typeorm.io
- TensorFlow.js : https://tensorflow.org/js
- Gemini API : https://ai.google.dev
- Express.js : https://expressjs.com
- Prometheus : https://prometheus.io

---

**Version** : 1.0.0  
**Date** : 3 décembre 2025  
**Auteur** : Équipe Backend Mobilisation
