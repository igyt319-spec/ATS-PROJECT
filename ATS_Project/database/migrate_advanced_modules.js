const db = require('./db');

async function runAdvancedModulesMigration() {
  console.log('[Migration] Starting Advanced Modules (Knowledge Graph, Study Planner) migration...');

  // 1. Create academic_knowledge_nodes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS academic_knowledge_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      node_code VARCHAR(32) NOT NULL UNIQUE,
      label VARCHAR(140) NOT NULL,
      node_type ENUM('Subject', 'Core Concept', 'Prerequisite Topic', 'Technical Skill', 'Career Competency') NOT NULL,
      department_id INT NULL,
      subject_id INT NULL,
      semester_number TINYINT NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'Engineering Core',
      description TEXT NULL,
      difficulty_level ENUM('Fundamental', 'Intermediate', 'Advanced') DEFAULT 'Intermediate',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_node_type (node_type),
      KEY idx_dept (department_id),
      KEY idx_subj (subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Created table academic_knowledge_nodes.');

  // 2. Create academic_knowledge_edges table
  await db.query(`
    CREATE TABLE IF NOT EXISTS academic_knowledge_edges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_node_id INT NOT NULL,
      target_node_id INT NOT NULL,
      relationship_type ENUM('prerequisite_of', 'concept_of', 'demonstrates_skill', 'required_for_career') NOT NULL,
      weight DECIMAL(3,2) DEFAULT 1.00,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_source (source_node_id),
      KEY idx_target (target_node_id),
      UNIQUE KEY uq_edge (source_node_id, target_node_id, relationship_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Created table academic_knowledge_edges.');

  // 3. Create student_study_plans table
  await db.query(`
    CREATE TABLE IF NOT EXISTS student_study_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      student_id INT NOT NULL,
      title VARCHAR(140) NOT NULL DEFAULT 'Adaptive Semester Revision Plan',
      weekly_goal_hours DECIMAL(4,1) DEFAULT 12.0,
      preferred_days VARCHAR(120) DEFAULT 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday',
      target_date DATE NULL,
      focus_areas JSON NULL,
      status ENUM('Active', 'Completed', 'Archived') DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_stu_plan (student_id),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Created table student_study_plans.');

  // 4. Create student_study_tasks table
  await db.query(`
    CREATE TABLE IF NOT EXISTS student_study_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      plan_id INT NOT NULL,
      student_id INT NOT NULL,
      subject_id INT NULL,
      subject_name VARCHAR(140) NOT NULL,
      topic_name VARCHAR(180) NOT NULL,
      prerequisite_topics VARCHAR(255) NULL,
      priority ENUM('High', 'Medium', 'Low') DEFAULT 'Medium',
      estimated_hours DECIMAL(4,1) DEFAULT 2.0,
      completed_hours DECIMAL(4,1) DEFAULT 0.0,
      status ENUM('Not Started', 'In Progress', 'Completed') DEFAULT 'Not Started',
      target_date DATE NULL,
      resource_recommendation TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_task_plan (plan_id),
      KEY idx_task_student (student_id),
      KEY idx_task_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✅ Created table student_study_tasks.');

  // 5. Seed Knowledge Graph Nodes and Edges if empty
  const [[nodeCount]] = await db.query('SELECT COUNT(*) AS total FROM academic_knowledge_nodes');
  if (nodeCount.total === 0) {
    console.log('[Migration] Seeding curriculum knowledge graph nodes & prerequisite relationships...');

    const nodes = [
      // Fundamental Mathematics & Logic
      ['MATH01', 'Engineering Mathematics I', 'Subject', null, null, 1, 'Mathematics', 'Calculus, differential equations, and linear algebra fundamentals', 'Fundamental'],
      ['MATH02', 'Engineering Mathematics II', 'Subject', null, null, 2, 'Mathematics', 'Vector calculus, complex variables, and series solutions', 'Intermediate'],
      ['MATH03', 'Discrete Mathematics & Graph Theory', 'Subject', null, null, 3, 'Mathematics', 'Set theory, predicate logic, relations, graphs, and combinatorics', 'Intermediate'],
      ['LOGIC01', 'Boolean Algebra & Logic Simplification', 'Prerequisite Topic', null, null, 1, 'Mathematics', 'K-maps, logic minimization, De Morgan laws', 'Fundamental'],
      ['CALC01', 'Multivariable Calculus & Optimization', 'Core Concept', null, null, 2, 'Mathematics', 'Gradient descent, partial derivatives, extrema', 'Intermediate'],

      // Programming & Core CS
      ['CS01', 'Programming Fundamentals', 'Subject', null, null, 1, 'Computer Science', 'Imperative programming, syntax, control flow, functions, memory', 'Fundamental'],
      ['CS02', 'Data Structures and Algorithms', 'Subject', null, null, 3, 'Computer Science', 'Linear and non-linear data structures, trees, dynamic programming', 'Intermediate'],
      ['CS03', 'Digital Systems & Logic Design', 'Subject', null, null, 3, 'Computer Systems', 'Combinational circuits, sequential circuits, state machines', 'Intermediate'],
      ['CS04', 'Database Systems', 'Subject', null, null, 5, 'Software Systems', 'Relational models, SQL, normalization, concurrency control, ACID', 'Intermediate'],
      ['CS05', 'Operating Systems Fundamentals', 'Subject', null, null, 4, 'Computer Systems', 'Process scheduling, virtual memory, synchronization, file systems', 'Intermediate'],
      ['CS06', 'Computer Networks & Security', 'Subject', null, null, 5, 'Network Systems', 'TCP/IP stack, routing protocols, TLS/SSL, network security', 'Advanced'],
      ['CS07', 'Machine Learning & Predictive Systems', 'Subject', null, null, 6, 'Artificial Intelligence', 'Supervised/unsupervised learning, neural models, model validation', 'Advanced'],
      ['CS08', 'Software Engineering & Agile Methodologies', 'Subject', null, null, 6, 'Software Systems', 'CI/CD, architecture patterns, test-driven design, DevOps', 'Intermediate'],

      // Core Concepts
      ['CONCEPT_RECURSION', 'Recursion & Divide-and-Conquer', 'Core Concept', null, null, 2, 'Computer Science', 'Recursive decomposition, master theorem, base cases', 'Intermediate'],
      ['CONCEPT_DYNAMIC_PROG', 'Dynamic Programming & Memoization', 'Core Concept', null, null, 3, 'Computer Science', 'Optimal substructure, overlapping subproblems', 'Advanced'],
      ['CONCEPT_CIRCUITS', 'Combinational & Sequential Circuits', 'Core Concept', null, null, 3, 'Computer Systems', 'Multiplexers, flip-flops, registers, counters', 'Intermediate'],
      ['CONCEPT_NORMALIZATION', 'Database Normalization (1NF–BCNF)', 'Core Concept', null, null, 5, 'Software Systems', 'Functional dependencies, lossless decomposition', 'Intermediate'],
      ['CONCEPT_INDEXING', 'B-Tree Indexing & Query Execution Plans', 'Core Concept', null, null, 5, 'Software Systems', 'Clustered indices, execution plans, query optimization', 'Advanced'],
      ['CONCEPT_SYNCHRONIZATION', 'Process Concurrency & Mutex Locks', 'Core Concept', null, null, 4, 'Computer Systems', 'Semaphores, race conditions, deadlock prevention', 'Advanced'],
      ['CONCEPT_GRADIENT', 'Gradient Optimization & Cost Functions', 'Core Concept', null, null, 6, 'Artificial Intelligence', 'Cost surfaces, backpropagation, learning rates', 'Advanced'],

      // Technical Skills
      ['SKILL_PYTHON', 'Python Systems Programming', 'Technical Skill', null, null, null, 'Programming', 'Python language fluency, OOP, asyncio, packaging', 'Intermediate'],
      ['SKILL_ALGO', 'Algorithmic Problem Solving', 'Technical Skill', null, null, null, 'Computer Science', 'Time/space complexity analysis, graph traversals', 'Advanced'],
      ['SKILL_SQL', 'Relational Database Architecture & SQL', 'Technical Skill', null, null, null, 'Data Engineering', 'Complex joins, transactions, schema design', 'Intermediate'],
      ['SKILL_LINUX', 'Linux Systems Administration & Bash', 'Technical Skill', null, null, null, 'DevOps', 'POSIX shell, process supervision, system calls', 'Intermediate'],
      ['SKILL_ML', 'Machine Learning Pipeline Engineering', 'Technical Skill', null, null, null, 'Artificial Intelligence', 'Feature engineering, scikit-learn, PyTorch, evaluation', 'Advanced'],
      ['SKILL_API', 'RESTful API & Distributed Microservices', 'Technical Skill', null, null, null, 'Software Architecture', 'HTTP specs, API design, JWT auth, stateless services', 'Intermediate'],

      // Career Competencies
      ['CAREER_SWE', 'Full-Stack Software Engineer', 'Career Competency', null, null, null, 'Career Role', 'End-to-end web architectures, clean code, scalable APIs', 'Advanced'],
      ['CAREER_DATA', 'Data Engineer & Analytics Architect', 'Career Competency', null, null, null, 'Career Role', 'ETL pipelines, database warehousing, analytical querying', 'Advanced'],
      ['CAREER_ML', 'Machine Learning Engineer', 'Career Competency', null, null, null, 'Career Role', 'Production model deployment, feature stores, MLOps', 'Advanced'],
      ['CAREER_DEVOPS', 'Cloud & Site Reliability Engineer', 'Career Competency', null, null, null, 'Career Role', 'Infrastructure as Code, monitoring, container orchestration', 'Advanced']
    ];

    for (const [code, label, type, deptId, subjId, sem, cat, desc, diff] of nodes) {
      await db.query(`
        INSERT INTO academic_knowledge_nodes 
        (node_code, label, node_type, department_id, subject_id, semester_number, category, description, difficulty_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE label=VALUES(label), description=VALUES(description)
      `, [code, label, type, deptId, subjId, sem, cat, desc, diff]);
    }

    // Connect nodes by edge relationships
    const edges = [
      // Mathematics -> Logic & CS
      ['LOGIC01', 'MATH01', 'prerequisite_of', 'Boolean algebra foundation for discrete structures'],
      ['MATH01', 'MATH02', 'prerequisite_of', 'Calculus I is a prerequisite for Calculus II'],
      ['MATH02', 'CALC01', 'concept_of', 'Multivariable calculus builds directly on Math II'],
      ['LOGIC01', 'CS03', 'prerequisite_of', 'Logic gates and Boolean simplification needed for Digital Systems'],
      ['CS03', 'CONCEPT_CIRCUITS', 'concept_of', 'Circuits are the fundamental core of digital systems'],
      ['CS01', 'CS02', 'prerequisite_of', 'Programming fundamentals is essential before data structures'],
      ['CS01', 'CONCEPT_RECURSION', 'concept_of', 'Recursion is introduced in Programming Fundamentals'],
      ['CONCEPT_RECURSION', 'CS02', 'prerequisite_of', 'Recursive thinking is required for tree and graph algorithms'],
      ['CS02', 'CONCEPT_DYNAMIC_PROG', 'concept_of', 'Dynamic programming is an advanced algorithm paradigm'],
      ['CS02', 'CS04', 'prerequisite_of', 'Tree structures (B-Trees) are required for database indexing'],
      ['CS04', 'CONCEPT_NORMALIZATION', 'concept_of', 'Schema design relies on 1NF–BCNF normalization rules'],
      ['CS04', 'CONCEPT_INDEXING', 'concept_of', 'High-performance query execution requires indexing structures'],
      ['CS02', 'CS05', 'prerequisite_of', 'Queue and priority queue data structures needed for OS schedulers'],
      ['CS05', 'CONCEPT_SYNCHRONIZATION', 'concept_of', 'Process concurrency and mutex locks are central to OS architecture'],
      ['CALC01', 'CONCEPT_GRADIENT', 'concept_of', 'Partial derivatives and cost optimization form gradient descent'],
      ['CONCEPT_GRADIENT', 'CS07', 'prerequisite_of', 'Gradient optimization is required for Machine Learning models'],
      ['CS02', 'CS07', 'prerequisite_of', 'Efficient feature vector processing relies on algorithms'],
      ['CS04', 'CS06', 'prerequisite_of', 'Client-server state storage requires database fundamentals'],
      ['CS01', 'CS08', 'prerequisite_of', 'Code design and test automation build on programming fundamentals'],

      // Subjects/Concepts -> Technical Skills
      ['CS01', 'SKILL_PYTHON', 'demonstrates_skill', 'Mastery in foundational programming and syntax'],
      ['CS02', 'SKILL_ALGO', 'demonstrates_skill', 'Mastery in algorithmic problem solving and Big-O analysis'],
      ['CS04', 'SKILL_SQL', 'demonstrates_skill', 'Mastery in relational database schema and query tuning'],
      ['CS05', 'SKILL_LINUX', 'demonstrates_skill', 'Understanding of operating system internals and shell scripting'],
      ['CS07', 'SKILL_ML', 'demonstrates_skill', 'Understanding predictive algorithms and model pipelines'],
      ['CS08', 'SKILL_API', 'demonstrates_skill', 'Understanding software design, clean architecture, and web APIs'],

      // Technical Skills -> Career Competencies
      ['SKILL_ALGO', 'CAREER_SWE', 'required_for_career', 'Core coding and algorithmic competency'],
      ['SKILL_SQL', 'CAREER_SWE', 'required_for_career', 'Application persistence and database transactions'],
      ['SKILL_API', 'CAREER_SWE', 'required_for_career', 'Microservices and backend development'],
      ['SKILL_SQL', 'CAREER_DATA', 'required_for_career', 'Data warehousing and query extraction'],
      ['SKILL_PYTHON', 'CAREER_DATA', 'required_for_career', 'Data transformation scripts and pipeline automation'],
      ['SKILL_ML', 'CAREER_ML', 'required_for_career', 'Training and evaluating predictive models'],
      ['SKILL_ALGO', 'CAREER_ML', 'required_for_career', 'Mathematical and algorithmic optimization'],
      ['SKILL_LINUX', 'CAREER_DEVOPS', 'required_for_career', 'Server orchestration, Linux kernel parameters, and reliability'],
      ['SKILL_API', 'CAREER_DEVOPS', 'required_for_career', 'API gateways and ingress routing']
    ];

    for (const [srcCode, tgtCode, relType, desc] of edges) {
      await db.query(`
        INSERT INTO academic_knowledge_edges (source_node_id, target_node_id, relationship_type, description)
        SELECT s.id, t.id, ?, ?
        FROM academic_knowledge_nodes s, academic_knowledge_nodes t
        WHERE s.node_code = ? AND t.node_code = ?
        ON DUPLICATE KEY UPDATE description=VALUES(description)
      `, [relType, desc, srcCode, tgtCode]);
    }

    console.log(`✅ Seeded ${nodes.length} knowledge graph nodes and ${edges.length} prerequisite edges.`);
  }

  console.log('✅ Advanced Modules migration completed successfully.');
}

if (require.main === module) {
  runAdvancedModulesMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { runAdvancedModulesMigration };
