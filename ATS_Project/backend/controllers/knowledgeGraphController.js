const db = require('../../database/db');

/**
 * GET /api/knowledge-graph
 * Query parameters: student_id (optional), semester (optional), category (optional)
 * Returns the graph nodes, edges, student-specific weak concept highlights, and metadata.
 */
async function getKnowledgeGraph(req, res) {
  try {
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : (req.user?.role === 'student' ? req.user.studentId : null);
    const semester = req.query.semester ? parseInt(req.query.semester, 10) : null;
    const category = req.query.category || null;

    let nodeQuery = 'SELECT * FROM academic_knowledge_nodes WHERE is_active = 1';
    const nodeParams = [];

    if (semester) {
      nodeQuery += ' AND (semester_number = ? OR semester_number IS NULL)';
      nodeParams.push(semester);
    }
    if (category && category !== 'All') {
      nodeQuery += ' AND category = ?';
      nodeParams.push(category);
    }

    const [nodes] = await db.query(nodeQuery, nodeParams);

    const [edges] = await db.query(`
      SELECT e.*, s.node_code AS source_code, t.node_code AS target_code
      FROM academic_knowledge_edges e
      JOIN academic_knowledge_nodes s ON s.id = e.source_node_id
      JOIN academic_knowledge_nodes t ON t.id = e.target_node_id
    `);

    // If student ID provided, analyze weak academic areas from real marks
    const weakAreas = [];
    const weakSubjectCodes = new Set();
    const weakConceptIds = new Set();

    if (studentId) {
      const [marksRows] = await db.query(`
        SELECT m.*, s.subject_name, s.subject_code, s.semester_number, d.name AS department_name
        FROM marks m
        JOIN subjects s ON s.id = m.subject_id
        LEFT JOIN departments d ON d.id = s.department_id
        WHERE m.student_id = ? AND (m.total_marks < 60 OR m.status = 'Weak' OR m.grade IN ('C', 'F'))
        ORDER BY m.total_marks ASC
      `, [studentId]);

      for (const m of marksRows) {
        weakSubjectCodes.add(m.subject_code);
        weakAreas.push({
          subject_id: m.subject_id,
          subject_name: m.subject_name,
          subject_code: m.subject_code,
          semester: m.semester_number,
          total_marks: Number(m.total_marks),
          internal_marks: Number(m.internal_marks),
          exam_marks: Number(m.exam_marks),
          grade: m.grade,
          status: m.status || 'Weak',
          evidence: `Exam total ${m.total_marks}/100 (Internal: ${m.internal_marks}, End-Sem: ${m.exam_marks}) below institutional mastery threshold.`
        });
      }

      // Flag nodes directly associated or downstream of weak subjects
      nodes.forEach(node => {
        const isDirectWeak = weakAreas.some(w => 
          (node.label && w.subject_name.toLowerCase().includes(node.label.toLowerCase())) ||
          (node.description && w.subject_name.toLowerCase().includes(node.description.toLowerCase()))
        );
        if (isDirectWeak) {
          weakConceptIds.add(node.id);
        }
      });
    }

    // Attach weak flag and prerequisite list to nodes
    const enrichedNodes = nodes.map(n => {
      const isWeak = weakConceptIds.has(n.id);
      const incomingEdges = edges.filter(e => e.target_node_id === n.id && e.relationship_type === 'prerequisite_of');
      const outgoingEdges = edges.filter(e => e.source_node_id === n.id);

      return {
        ...n,
        is_weak_area: isWeak,
        prerequisites_count: incomingEdges.length,
        dependencies_count: outgoingEdges.length
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        nodes: enrichedNodes,
        edges,
        weakAreas,
        weakConceptIds: Array.from(weakConceptIds),
        categories: [...new Set(nodes.map(n => n.category))],
        semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        student_id: studentId
      }
    });
  } catch (err) {
    console.error('[getKnowledgeGraph Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/knowledge-graph/node/:nodeId
 * Returns detail panel info, prerequisite chain, and revision topics for a specific node
 */
async function getNodeDetails(req, res) {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);
    const [nodes] = await db.query('SELECT * FROM academic_knowledge_nodes WHERE id = ?', [nodeId]);

    if (nodes.length === 0) {
      return res.status(404).json({ success: false, message: 'Node not found.' });
    }

    const node = nodes[0];

    // Find prerequisites
    const [prereqs] = await db.query(`
      SELECT s.*, e.description AS edge_desc, e.relationship_type
      FROM academic_knowledge_edges e
      JOIN academic_knowledge_nodes s ON s.id = e.source_node_id
      WHERE e.target_node_id = ?
    `, [nodeId]);

    // Find downstream topics enabled by this node
    const [enables] = await db.query(`
      SELECT t.*, e.description AS edge_desc, e.relationship_type
      FROM academic_knowledge_edges e
      JOIN academic_knowledge_nodes t ON t.id = e.target_node_id
      WHERE e.source_node_id = ?
    `, [nodeId]);

    // Suggested revision topics
    const suggestedRevisionTopics = [
      `Foundations of ${node.label}`,
      `Problem Solving & Case Studies for ${node.label}`,
      `Practical Applications & Diagnostic Exercises`
    ];

    return res.status(200).json({
      success: true,
      data: {
        node,
        prerequisites: prereqs,
        enablesTopics: enables,
        suggestedRevisionTopics
      }
    });
  } catch (err) {
    console.error('[getNodeDetails Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getKnowledgeGraph,
  getNodeDetails
};
