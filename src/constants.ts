export const responseFormatPrompt =
  "You must respond in MARKDOWN format. The response should include the following fields: diagram: The generated diagram in Mermaid syntax. difficulty: The difficulty level of the diagram (Easy, Medium, Hard). The diagram must be surrounded by triple backticks (```), and the difficulty must be on a new line after the closing backticks. For example: ```mermaid diagram code``` difficulty: Easy";

export const promptPrefix = (type: string): string => {
  return `You are an expert at creating technical ${type} diagrams. You have been asked to create a technical ${type} diagram for a coding project. The diagram you create should be detailed and informative based on the information given by the user. Below are some examples of ${type} diagrams:`;
};

export const flowchartExamples = `
# Flowchart Syntax Examples
    \`\`\`
    graph TD;
        A-->B;
        A-->C;
        B-->D;
        C-->D;
    \`\`\`

    \`\`\`
    flowchart LR
        id1(This is the text in the box)
    \`\`\`

    \`\`\`
    flowchart LR
        id1([This is the text in the box])
    \`\`\`

    \`\`\`
    flowchart LR
        id1[[This is the text in the box]]
    \`\`\`

    \`\`\`
    flowchart LR
        id1[(Database)]
    \`\`\`

    \`\`\`
    flowchart LR
        id1((This is the text in the circle))
    \`\`\`

    \`\`\`
    flowchart LR
        id1>This is the text in the box]
    \`\`\`

    \`\`\`
    flowchart LR
        id1{{This is the text in the box}}
    \`\`\`

    \`\`\`
    flowchart LR
        A:::foo & B:::bar --> C:::foobar
        classDef foo stroke:#f00
        classDef bar stroke:#0f0
        classDef foobar stroke:#00f
    \`\`\`

    \`\`\`
    flowchart LR
    A -- text --> B -- text2 --> C
    \`\`\`

    \`\`\`
    flowchart LR
    a --> b & c--> d
    \`\`\`

    \`\`\`
    flowchart TB
        A & B--> C & D
    \`\`\`

    \`\`\`
    flowchart TD
        A[Start] --> B{{Is it?}}
        B -->|Yes| C[OK]
        C --> D[Rethink]
        D --> B
        B ---->|No| E[End]
    \`\`\`

    \`\`\`
    flowchart TB
        c1-->a2
        subgraph one
        a1-->a2
        end
        subgraph two
        b1-->b2
        end
        subgraph three
        c1-->c2
        end
    \`\`\`

    \`\`\`
    flowchart LR
        A[Hard edge] -->|Link text| B(Round edge)
        B --> C{{Decision}}
        C -->|One| D[Result one]
        C -->|Two| E[Result two]
    \`\`\`
`;

export const sequenceDiagramExamples = `
    # Sequence Syntax Examples
    \`\`\`
    sequenceDiagram
        Alice->>John: Hello John, how are you?
        John-->>Alice: Great!
        Alice-)John: See you later!
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant Alice
        participant Bob
        Alice->>Bob: Hi Bob
        Bob->>Alice: Hi Alice
    \`\`\`

    \`\`\`
    sequenceDiagram
        actor Alice
        actor Bob
        Alice->>Bob: Hi Bob
        Bob->>Alice: Hi Alice
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant A as Alice
        participant J as John
        A->>J: Hello John, how are you?
        J->>A: Great!
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->>Bob: Hello Bob, how are you ?
        Bob->>Alice: Fine, thank you. And you?
        create participant Carl
        Alice->>Carl: Hi Carl!
        create actor D as Donald
        Carl->>D: Hi!
        destroy Carl
        Alice-xCarl: We are too many
        destroy Bob
        Bob->>Alice: I agree
    \`\`\`

    \`\`\`
    sequenceDiagram
    box Purple Alice & John
    participant A
    participant J
    end
    box Another Group
    participant B
    participant C
    end
    A->>J: Hello John, how are you?
    J->>A: Great!
    A->>B: Hello Bob, how is Charley?
    B->>C: Hello Charley, how are you?
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->>John: Hello John, how are you?
        activate John
        John-->>Alice: Great!
        deactivate John
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->>+John: Hello John, how are you?
        John-->>-Alice: Great!
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->>+John: Hello John, how are you?
        Alice->>+John: John, can you hear me?
        John-->>-Alice: Hi Alice, I can hear you!
        John-->>-Alice: I feel great!
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant John
        Note right of John: Text in note
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->John: Hello John, how are you?
        Note over Alice,John: A typical interaction
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->John: Hello John, how are you?
        loop Every minute
            John-->Alice: Great!
        end
    \`\`\`

    \`\`\`
    sequenceDiagram
        Alice->>Bob: Hello Bob, how are you?
        alt is sick
            Bob->>Alice: Not so good
        else is well
            Bob->>Alice: Feeling fresh like a daisy
        end
        opt Extra response
            Bob->>Alice: Thanks for asking
        end
    \`\`\`

    \`\`\`
    sequenceDiagram
        par Alice to Bob
            Alice->>Bob: Hello guys!
        and Alice to John
            Alice->>John: Hello guys!
        end
        Bob-->>Alice: Hi Alice!
        John-->>Alice: Hi Alice!
    \`\`\`

    \`\`\`
    sequenceDiagram
        par Alice to Bob
            Alice->>Bob: Go help John
        and Alice to John
            Alice->>John: I want this done today
            par John to Charlie
                John->>Charlie: Can we do this today?
            and John to Diana
                John->>Diana: Can you help us today?
            end
        end
    \`\`\`

    \`\`\`
    sequenceDiagram
        critical Establish a connection to the DB
            Service-->DB: connect
        option Network timeout
            Service-->Service: Log error
        option Credentials rejected
            Service-->Service: Log different error
        end
    \`\`\`

    \`\`\`
    sequenceDiagram
        critical Establish a connection to the DB
            Service-->DB: connect
        end
    \`\`\`

    \`\`\`
    sequenceDiagram
        Consumer-->API: Book something
        API-->BookingService: Start booking process
        break when the booking process fails
            API-->Consumer: show failure
        end
        API-->BillingService: Start billing process
    \`\`\`



    \`\`\`
    sequenceDiagram
        Alice->>John: Hello John, how are you?
        %% this is a comment
        John-->>Alice: Great!
    \`\`\`

    \`\`\`
    sequenceDiagram
        A->>B: I #9829; you!
        B->>A: I #9829; you #infin; times more!
    \`\`\`

    \`\`\`
    sequenceDiagram
        autonumber
        Alice->>John: Hello John, how are you?
        loop HealthCheck
            John->>John: Fight against hypochondria
        end
        Note right of John: Rational thoughts!
        John-->>Alice: Great!
        John->>Bob: How about you?
        Bob-->>John: Jolly good!
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant Alice
        participant John

        rect rgb(191, 223, 255)
        note right of Alice: Alice calls John.
        Alice->>+John: Hello John, how are you?
        rect rgb(200, 150, 255)
        Alice->>+John: John, can you hear me?
        John-->>-Alice: Hi Alice, I can hear you!
        end
        John-->>-Alice: I feel great!
        end
        Alice ->>+ John: Did you want to go to the game tonight?
        John -->>- Alice: Yeah! See you there.
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant Alice
        participant John
        link Alice: Dashboard @ https://dashboard.contoso.com/alice
        link Alice: Wiki @ https://wiki.contoso.com/alice
        link John: Dashboard @ https://dashboard.contoso.com/john
        link John: Wiki @ https://wiki.contoso.com/john
        Alice->>John: Hello John, how are you?
        John-->>Alice: Great!
        Alice-)John: See you later!
    \`\`\`

    \`\`\`
    sequenceDiagram
        participant Alice
        participant John
        links Alice: {{"Dashboard": "https://dashboard.contoso.com/alice", "Wiki": "https://wiki.contoso.com/alice"}}
        links John: {{"Dashboard": "https://dashboard.contoso.com/john", "Wiki": "https://wiki.contoso.com/john"}}
        Alice->>John: Hello John, how are you?
        John-->>Alice: Great!
        Alice-)John: See you later!
    \`\`\`
`;

export const classDiagramExamples = `
    # Class Diagram Syntax Examples
    \`\`\`
    ---
    title: Animal example
    ---
    classDiagram
    note "From Duck till Zebra"
    Animal <|-- Duck
    note for Duck "can fly\ncan swim\ncan dive\ncan help in debugging"
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{{
        +String beakColor
        +swim()
        +quack()
    }}
    class Fish{{
        -int sizeInFeet
        -canEat()
    }}
    class Zebra{{
        +bool is_wild
        +run()
    }}
    \`\`\`

    \`\`\`
    ---
    title: Bank example
    ---
    classDiagram
        class BankAccount
        BankAccount : +String owner
        BankAccount : +Bigdecimal balance
        BankAccount : +deposit(amount)
        BankAccount : +withdrawal(amount)

    \`\`\`

    \`\`\`
    classDiagram
        class Animal
        Vehicle <|-- Car
    \`\`\`

    \`\`\`
    classDiagram
        class Animal["Animal with a label"]
        class Car["Car with *! symbols"]
        Animal --> Car
    \`\`\`

    \`\`\`
    classDiagram
        class \`Animal Class!\`
        class \`Car Class\`
        \`Animal Class!\` --> \`Car Class\`
    \`\`\`

    \`\`\`
    classDiagram
    class BankAccount{{
        +String owner
        +BigDecimal balance
        +deposit(amount)
        +withdrawal(amount)
    }}
    \`\`\`

    \`\`\`
    classDiagram
    class BankAccount{{
        +String owner
        +BigDecimal balance
        +deposit(amount) bool
        +withdrawal(amount) int
    }}
    \`\`\`

    \`\`\`
    classDiagram
    class Square~Shape~{{
        int id
        List~int~ position
        setPoints(List~int~ points)
        getPoints() List~int~
    }}

    Square : -List~string~ messages
    Square : +setMessages(List~string~ messages)
    Square : +getMessages() List~string~
    Square : +getDistanceMatrix() List~List~int~~
    \`\`\`

    \`\`\`
    classDiagram
    classA <|-- classB
    classC *-- classD
    classE o-- classF
    classG <-- classH
    classI -- classJ
    classK <.. classL
    classM <|.. classN
    classO .. classP
    \`\`\`

    \`\`\`
    classDiagram
    classA --|> classB : Inheritance
    classC --* classD : Composition
    classE --o classF : Aggregation
    classG --> classH : Association
    classI -- classJ : Link(Solid)
    classK ..> classL : Dependency
    classM ..|> classN : Realization
    classO .. classP : Link(Dashed)
    \`\`\`

    \`\`\`
    classDiagram
    classA <|-- classB : implements
    classC *-- classD : composition
    classE o-- classF : aggregation
    \`\`\`

    \`\`\`
    classDiagram
        Animal <|--|> Zebra
    \`\`\`

    \`\`\`
    classDiagram
    namespace BaseShapes {{
        class Triangle
        class Rectangle {{
        double width
        double height
        }}
    }}
    \`\`\`

    \`\`\`
    classDiagram
        Customer "1" --> "*" Ticket
        Student "1" --> "1..*" Course
        Galaxy --> "many" Star : Contains
    \`\`\`

    \`\`\`
    classDiagram
    class Shape
    <<interface>> Shape
    Shape : noOfVertices
    Shape : draw()
    \`\`\`

    \`\`\`
    classDiagram
    class Shape{{
        <<interface>>
        noOfVertices
        draw()
    }}
    class Color{{
        <<enumeration>>
        RED
        BLUE
        GREEN
        WHITE
        BLACK
    }}

    \`\`\`

    \`\`\`
    classDiagram
    %% This whole line is a comment classDiagram class Shape <<interface>>
    class Shape{{
        <<interface>>
        noOfVertices
        draw()
    }}
    \`\`\`

    \`\`\`
    classDiagram
    direction RL
    class Student {{
        -idCard : IdCard
    }}
    class IdCard{{
        -id : int
        -name : string
    }}
    class Bike{{
        -id : int
        -name : string
    }}
    Student "1" --o "1" IdCard : carries
    Student "1" --o "1" Bike : rides
    \`\`\`

    \`\`\`
    classDiagram
        note "This is a general note"
        note for MyClass "This is a note for a class"
        class MyClass{{
        }}
    \`\`\`

    \`\`\`
    classDiagram
    class Shape
    link Shape "https://www.github.com" "This is a tooltip for a link"
    class Shape2
    click Shape2 href "https://www.github.com" "This is a tooltip for a link"
    \`\`\`

    \`\`\`
    classDiagram
    class Shape
    callback Shape "callbackFunction" "This is a tooltip for a callback"
    class Shape2
    click Shape2 call callbackFunction() "This is a tooltip for a callback"
    \`\`\`

    \`\`\`
    classDiagram
    class Animal
    class Mineral
    style Animal fill:#f9f,stroke:#333,stroke-width:4px
    style Mineral fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 5 5
    \`\`\`
`;

export const stateDiagramExamples = `
 # State Diagram Syntax Examples
    \`\`\`
    ---
    title: Simple sample
    ---
    stateDiagram-v2
        [*] --> Still
        Still --> [*]

        Still --> Moving
        Moving --> Still
        Moving --> Crash
        Crash --> [*]
    \`\`\`

    \`\`\`
    stateDiagram
        [*] --> Still
        Still --> [*]

        Still --> Moving
        Moving --> Still
        Moving --> Crash
        Crash --> [*]
    \`\`\`

    \`\`\`
    stateDiagram-v2
        stateId
    \`\`\`

    \`\`\`
    stateDiagram-v2
        state "This is a state description" as s2
    \`\`\`

    \`\`\`
    stateDiagram-v2
        s2 : This is a state description
    \`\`\`

    \`\`\`
    stateDiagram-v2
        s1 --> s2
    \`\`\`

    \`\`\`
    stateDiagram-v2
        s1 --> s2: A transition
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> s1
        s1 --> [*]
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> First
        state First {{
            [*] --> second
            second --> [*]
        }}
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> First

        state First {{
            [*] --> Second

            state Second {{
                [*] --> second
                second --> Third

                state Third {{
                    [*] --> third
                    third --> [*]
                }}
            }}
        }}
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> First
        First --> Second
        First --> Third

        state First {{
            [*] --> fir
            fir --> [*]
        }}
        state Second {{
            [*] --> sec
            sec --> [*]
        }}
        state Third {{
            [*] --> thi
            thi --> [*]
        }}
    \`\`\`

    \`\`\`
    stateDiagram-v2
        state if_state <<choice>>
        [*] --> IsPositive
        IsPositive --> if_state
        if_state --> False: if n < 0
        if_state --> True : if n >= 0
    \`\`\`

    \`\`\`
    stateDiagram-v2
        state fork_state <<fork>>
        [*] --> fork_state
        fork_state --> State2
        fork_state --> State3

        state join_state <<join>>
        State2 --> join_state
        State3 --> join_state
        join_state --> State4
        State4 --> [*]
    \`\`\`

    \`\`\`
        stateDiagram-v2
            State1: The state with a note
            note right of State1
                Important information! You can write
                notes.
            end note
            State1 --> State2
            note left of State2 : This is the note to the left.
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> Active

        state Active {{
            [*] --> NumLockOff
            NumLockOff --> NumLockOn : EvNumLockPressed
            NumLockOn --> NumLockOff : EvNumLockPressed
            --
            [*] --> CapsLockOff
            CapsLockOff --> CapsLockOn : EvCapsLockPressed
            CapsLockOn --> CapsLockOff : EvCapsLockPressed
            --
            [*] --> ScrollLockOff
            ScrollLockOff --> ScrollLockOn : EvScrollLockPressed
            ScrollLockOn --> ScrollLockOff : EvScrollLockPressed
        }}
    \`\`\`

    \`\`\`
    stateDiagram
        direction LR
        [*] --> A
        A --> B
        B --> C
        state B {{
        direction LR
        a --> b
        }}
        B --> D
    \`\`\`

    \`\`\`
    stateDiagram-v2
        [*] --> Still
        Still --> [*]
    %% this is a comment
        Still --> Moving
        Moving --> Still %% another comment
        Moving --> Crash
        Crash --> [*]
    \`\`\`

    \`\`\`
    stateDiagram
    direction TB

    accTitle: This is the accessible title
    accDescr: This is an accessible description

    classDef notMoving fill:white
    classDef movement font-style:italic
    classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow

    [*]--> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]

    class Still notMoving
    class Moving, Crash movement
    class Crash badBadEvent
    class end badBadEvent
    \`\`\`

    \`\`\`
    stateDiagram
    direction TB

    accTitle: This is the accessible title
    accDescr: This is an accessible description

    classDef notMoving fill:white
    classDef movement font-style:italic;
    classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow

    [*] --> Still:::notMoving
    Still --> [*]
    Still --> Moving:::movement
    Moving --> Still
    Moving --> Crash:::movement
    Crash:::badBadEvent --> [*]
    \`\`\`

    \`\`\`
    stateDiagram
        classDef yourState font-style:italic,font-weight:bold,fill:white

        yswsii: Your state with spaces in it
        [*] --> yswsii:::yourState
        [*] --> SomeOtherState
        SomeOtherState --> YetAnotherState
        yswsii --> YetAnotherState
        YetAnotherState --> [*]
    \`\`\`
`;

export const erDiagramExamples = `
    # ER Diagram Syntax Examples
    \`\`\`
    ---
    title: Order example
    ---
    erDiagram
        CUSTOMER ||--o{{ ORDER : places
        ORDER ||--|{{ LINE-ITEM : contains
        CUSTOMER }}|..|{{ DELIVERY-ADDRESS : uses
    \`\`\`

                    \`\`\`
                    erDiagram
        CUSTOMER ||--o{{ ORDER : places
        CUSTOMER {{
            string name
            string custNumber
            string sector
        }}
        ORDER ||--|{{ LINE-ITEM : contains
        ORDER {{
            int orderNumber
            string deliveryAddress
        }}
        LINE-ITEM {{
            string productCode
            int quantity
            float pricePerUnit
        }}
    \`\`\`

    \`\`\`
    erDiagram
        CAR ||--o{{ NAMED-DRIVER : allows
        PERSON ||--o{{ NAMED-DRIVER : is
    \`\`\`

    \`\`\`
    erDiagram
        CAR ||--o{{ NAMED-DRIVER : allows
        CAR {{
            string registrationNumber
            string make
            string model
        }}
        PERSON ||--o{{ NAMED-DRIVER : is
        PERSON {{
            string firstName
            string lastName
            int age
        }}

    \`\`\`

    \`\`\`
    erDiagram
        p[Person] {{
            string firstName
            string lastName
        }}
        a["Customer Account"] {{
            string email
        }}
        p ||--o| a : has
    \`\`\`

    \`\`\`
    erDiagram
        CAR ||--o{{ NAMED-DRIVER : allows
        CAR {{
            string registrationNumber PK
            string make
            string model
            string[] parts
        }}
        PERSON ||--o{{ NAMED-DRIVER : is
        PERSON {{
            string driversLicense PK "The license #"
            string(99) firstName "Only 99 characters are allowed"
            string lastName
            string phone UK
            int age
        }}
        NAMED-DRIVER {{
            string carRegistrationNumber PK, FK
            string driverLicence PK, FK
        }}
        MANUFACTURER only one to zero or more CAR : makes
    \`\`\`
`;

export const getDiagramExamples = (type: string): string => {
  switch (type) {
    case "flowchart":
      return flowchartExamples;
    case "sequence":
      return sequenceDiagramExamples;
    case "classDiagram":
      return classDiagramExamples;
    case "stateDiagram":
      return stateDiagramExamples;
    case "erDiagram":
      return erDiagramExamples;
    default:
      return "";
  }
};
