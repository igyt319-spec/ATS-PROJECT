/**
 * Academic ATS — Advanced Intelligence & Specialized Modules Engine
 * 1. Academic Knowledge Graph (SVG Canvas + Accessible Table)
 * 2. Academic Trajectory Predictor (OLS Statistical Forecasting & Explainable Factors)
 * 3. Adaptive Study Planner (Prerequisite Priorities, Goal Tracking, Status Toggles)
 * 4. Skill Evidence Graph (Competencies, Verification, Career Gap Analysis)
 * 5. Intervention Effectiveness Engine (Signals, Before/After Delta, Outcome Measurement)
 * 6. Institution Department Mini Dashboards (Department Cards & Student Mini Dashboards)
 * 7. Simulated Demo Payment Workflow & Admin Reconciliation Audit Table
 */

const AdvancedModules = (function() {

  // Module Colors
  const COLORS = {
    cyan: '#38bdf8',
    purple: '#a855f7',
    emerald: '#10b981',
    amber: '#f59e0b',
    indigo: '#6366f1',
    rose: '#f43f5e',
    slate: '#94a3b8'
  };

  // Helper: Format Currency
  function formatINR(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // 1. ACADEMIC KNOWLEDGE GRAPH
  // =========================================================================
  async function initKnowledgeGraph(containerEl, studentId = null) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Loading Academic Knowledge Graph architecture...</div>
      </div>
    `;

    try {
      const url = studentId ? `/knowledge-graph?studentId=${studentId}` : '/knowledge-graph';
      const res = await apiCall(url);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to load Knowledge Graph.');
      }

      const { nodes, edges, weakConceptIds = [], weakConcepts = [], studentPerformance } = res.data;

      containerEl.innerHTML = `
        <div class="module-hero-banner cyan">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">🕸️</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Academic Knowledge Graph</h2>
              <span class="rule-engine-tag" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
                CURRICULUM MAPPING & WEAKNESS TRACE
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Structural network connecting university subjects, foundational concepts, prerequisite pathways, and validated industry skills. Nodes with red pulsing rings represent identified academic weakness areas from internal assessments.
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-secondary btn-sm" id="btn-kg-toggle-view" onclick="AdvancedModules.toggleKGView()">
              📋 View Accessible Table
            </button>
            <button class="btn btn-primary btn-sm" style="background: #0284c7;" onclick="AdvancedModules.resetKGZoom()">
              🎯 Reset Graph View
            </button>
          </div>
        </div>

        ${weakConcepts.length > 0 ? `
          <div class="glass-card" style="margin-bottom: 18px; padding: 14px 20px; border-left: 4px solid #f43f5e; background: rgba(244, 63, 94, 0.08);">
            <div style="font-weight: 700; color: #f43f5e; font-size: 0.9rem; margin-bottom: 4px;">
              ⚠️ Academic Weakness Identified in ${weakConcepts.length} Core Concept${weakConcepts.length > 1 ? 's' : ''}:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
              ${weakConcepts.map(c => `
                <span class="delta-pill negative" style="cursor: pointer;" onclick="AdvancedModules.selectKGNode('${c.id}')">
                  ${escapeHtml(c.label)} (Score: ${c.marks_obtained}/${c.max_marks})
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Filter Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">FILTER CATEGORY:</label>
            <select class="form-input" id="kg-category-filter" onchange="AdvancedModules.filterKGNodes()" style="width: auto; padding: 4px 10px; font-size: 0.82rem;">
              <option value="all">All Categories (${nodes.length} nodes)</option>
              <option value="Subject">Subjects</option>
              <option value="Core Concept">Core Concepts</option>
              <option value="Prerequisite Topic">Prerequisite Topics</option>
              <option value="Technical Skill">Technical Skills</option>
              <option value="Career Competency">Career Competencies</option>
            </select>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">
            <span>● Blue: Subject</span> &nbsp;|&nbsp; 
            <span>● Teal: Concept</span> &nbsp;|&nbsp; 
            <span>● Amber: Prereq</span> &nbsp;|&nbsp; 
            <span>● Emerald: Skill</span> &nbsp;|&nbsp; 
            <span style="color: #f43f5e;">● Red: Weakness Alert</span>
          </div>
        </div>

        <!-- Graph View Container -->
        <div id="kg-visual-container" class="graph-canvas-container">
          <div class="graph-svg-wrapper" id="kg-svg-host">
            <svg id="kg-svg" width="100%" height="560" style="background: #0d1117; cursor: grab;"></svg>
          </div>
          <div class="graph-side-panel" id="kg-side-panel">
            <div id="kg-panel-placeholder" style="color: var(--text-muted); text-align: center; padding-top: 100px;">
              <div style="font-size: 2rem; margin-bottom: 10px;">🔍</div>
              <div style="font-weight: 600;">Node Details</div>
              <div style="font-size: 0.82rem; margin-top: 4px;">Click on any graph node to inspect prerequisites, concept linkages, and recommended revision topics.</div>
            </div>
            <div id="kg-panel-content" style="display: none;"></div>
          </div>
        </div>

        <!-- Accessible Table Fallback (Hidden by default) -->
        <div id="kg-table-container" style="display: none;">
          <div class="table-container glass-card" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Node Label</th>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Weakness Status</th>
                  <th>Linkages</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="kg-table-tbody">
                ${nodes.map(n => {
                  const isWeak = weakConceptIds.includes(n.id);
                  return `
                    <tr>
                      <td><code>${escapeHtml(n.node_code)}</code></td>
                      <td style="font-weight: 600; color: #fff;">${escapeHtml(n.label)}</td>
                      <td><span class="badge ${n.node_type === 'Subject' ? 'badge-primary' : 'badge-secondary'}">${escapeHtml(n.node_type)}</span></td>
                      <td>${escapeHtml(n.difficulty_level || 'Intermediate')}</td>
                      <td>
                        ${isWeak ? '<span class="delta-pill negative">Weakness Detected</span>' : '<span class="delta-pill positive">Satisfactory</span>'}
                      </td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(n.category || 'Core')}</td>
                      <td>
                        <button class="btn btn-secondary btn-xs" onclick="AdvancedModules.selectKGNode('${n.id}')">Inspect</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Render the SVG Interactive Nodes & Edges
      renderKGSVG(nodes, edges, weakConceptIds);

      // Store in memory for interactions
      window._kgData = { nodes, edges, weakConceptIds, studentId };

    } catch (err) {
      console.error('[Knowledge Graph Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Knowledge Graph Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
          <button class="btn btn-secondary btn-sm" style="margin-top: 14px;" onclick="AdvancedModules.initKnowledgeGraph(document.getElementById('${containerEl.id}'), ${studentId})">Retry</button>
        </div>
      `;
    }
  }

  // Internal SVG Graph Renderer with Force Simulation coordinates
  function renderKGSVG(nodes, edges, weakConceptIds) {
    const svg = document.getElementById('kg-svg');
    if (!svg) return;

    const width = svg.clientWidth || 760;
    const height = 560;

    // Distribute nodes in clusters by node_type
    const typeClusters = {
      'Subject': { cx: width * 0.18, cy: height * 0.45, color: '#38bdf8' },
      'Core Concept': { cx: width * 0.42, cy: height * 0.45, color: '#2dd4bf' },
      'Prerequisite Topic': { cx: width * 0.42, cy: height * 0.80, color: '#f59e0b' },
      'Technical Skill': { cx: width * 0.68, cy: height * 0.45, color: '#10b981' },
      'Career Competency': { cx: width * 0.88, cy: height * 0.45, color: '#a855f7' }
    };

    const nodePositions = {};
    const clusterCounters = {};

    nodes.forEach((n, idx) => {
      const cluster = typeClusters[n.node_type] || { cx: width / 2, cy: height / 2, color: '#94a3b8' };
      if (!clusterCounters[n.node_type]) clusterCounters[n.node_type] = 0;
      const count = clusterCounters[n.node_type]++;
      
      const angle = (count * 0.85);
      const radius = 35 + (count * 18);
      const x = Math.min(width - 40, Math.max(40, cluster.cx + Math.cos(angle) * (radius % 120)));
      const y = Math.min(height - 40, Math.max(40, cluster.cy + Math.sin(angle) * (radius % 140)));

      nodePositions[n.id] = { x, y, node: n, color: cluster.color };
    });

    // Generate SVG content
    let svgHtml = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/>
        </marker>
        <marker id="arrow-weak" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e"/>
        </marker>
      </defs>
      <g id="kg-viewport">
    `;

    // Edges
    edges.forEach(e => {
      const src = nodePositions[e.source_node_id];
      const tgt = nodePositions[e.target_node_id];
      if (src && tgt) {
        const isWeakEdge = weakConceptIds.includes(e.source_node_id) || weakConceptIds.includes(e.target_node_id);
        const strokeColor = isWeakEdge ? 'rgba(244, 63, 94, 0.5)' : 'rgba(71, 85, 105, 0.4)';
        const marker = isWeakEdge ? 'url(#arrow-weak)' : 'url(#arrow)';
        svgHtml += `
          <line x1="${src.x}" y1="${src.y}" x2="${tgt.x}" y2="${tgt.y}" 
                stroke="${strokeColor}" stroke-width="${isWeakEdge ? 2 : 1.2}" 
                stroke-dasharray="${e.relationship_type === 'prerequisite_of' ? '4 2' : 'none'}" 
                marker-end="${marker}"/>
        `;
      }
    });

    // Nodes
    nodes.forEach(n => {
      const pos = nodePositions[n.id];
      if (!pos) return;

      const isWeak = weakConceptIds.includes(n.id);
      const radius = n.node_type === 'Subject' ? 18 : (n.node_type === 'Core Concept' ? 14 : 12);
      const fillColor = isWeak ? '#f43f5e' : pos.color;

      svgHtml += `
        <g class="graph-node ${isWeak ? 'weakness-node' : ''}" id="kg-node-${n.id}" 
           onclick="AdvancedModules.selectKGNode('${n.id}')" 
           transform="translate(${pos.x}, ${pos.y})">
          <circle r="${radius}" fill="${fillColor}" fill-opacity="${isWeak ? 0.9 : 0.8}" 
                  stroke="#ffffff" stroke-width="${isWeak ? 2.5 : 1.2}"/>
          <text y="${radius + 14}" text-anchor="middle" fill="#f1f5f9" font-size="10" font-weight="600" style="pointer-events: none;">
            ${escapeHtml(n.label.length > 20 ? n.label.slice(0, 18) + '...' : n.label)}
          </text>
        </g>
      `;
    });

    svgHtml += '</g>';
    svg.innerHTML = svgHtml;
  }

  function selectKGNode(nodeId) {
    if (!window._kgData) return;
    const node = window._kgData.nodes.find(n => String(n.id) === String(nodeId));
    if (!node) return;

    const sidePanel = document.getElementById('kg-side-panel');
    const placeholder = document.getElementById('kg-panel-placeholder');
    const content = document.getElementById('kg-panel-content');
    if (!sidePanel || !content) return;

    if (placeholder) placeholder.style.display = 'none';
    content.style.display = 'block';

    const isWeak = window._kgData.weakConceptIds.includes(node.id);

    // Incoming & Outgoing edges
    const incoming = window._kgData.edges.filter(e => e.target_node_id === node.id);
    const outgoing = window._kgData.edges.filter(e => e.source_node_id === node.id);

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <span class="badge ${node.node_type === 'Subject' ? 'badge-primary' : 'badge-secondary'}">${escapeHtml(node.node_type)}</span>
        <button class="btn btn-secondary btn-xs" onclick="AdvancedModules.closeKGPanel()">✕ Close</button>
      </div>

      <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 6px;">${escapeHtml(node.label)}</h3>
      <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 14px;">
        Code: <code>${escapeHtml(node.node_code)}</code> | Level: ${escapeHtml(node.difficulty_level || 'Intermediate')}
      </div>

      ${isWeak ? `
        <div style="background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 6px; padding: 10px 12px; margin-bottom: 14px;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #f43f5e; margin-bottom: 2px;">⚠️ Academic Weakness Alert</div>
          <div style="font-size: 0.76rem; color: var(--text-muted);">Assessment scores indicate this concept requires guided revision and prerequisite reinforcement.</div>
        </div>
      ` : ''}

      <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">
        ${escapeHtml(node.description || 'Core academic topic mapped into institutional curriculum graph.')}
      </div>

      <!-- Linkages -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">
          Prerequisites & Incoming Links (${incoming.length})
        </div>
        ${incoming.length === 0 ? '<div style="font-size: 0.76rem; color: var(--text-dim);">No prior prerequisites registered.</div>' : `
          <ul style="padding-left: 16px; font-size: 0.78rem; color: var(--text-muted);">
            ${incoming.map(e => {
              const srcNode = window._kgData.nodes.find(n => n.id === e.source_node_id);
              return `<li style="margin-bottom: 4px;"><strong>${escapeHtml(srcNode?.label || 'Topic')}</strong> (${escapeHtml(e.relationship_type.replace(/_/g, ' '))})</li>`;
            }).join('')}
          </ul>
        `}
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">
          Follow-up Topics & Outgoing Links (${outgoing.length})
        </div>
        ${outgoing.length === 0 ? '<div style="font-size: 0.76rem; color: var(--text-dim);">Final competency node.</div>' : `
          <ul style="padding-left: 16px; font-size: 0.78rem; color: var(--text-muted);">
            ${outgoing.map(e => {
              const tgtNode = window._kgData.nodes.find(n => n.id === e.target_node_id);
              return `<li style="margin-bottom: 4px;"><strong>${escapeHtml(tgtNode?.label || 'Topic')}</strong> (${escapeHtml(e.relationship_type.replace(/_/g, ' '))})</li>`;
            }).join('')}
          </ul>
        `}
      </div>

      <!-- Action Button: Link to Study Planner -->
      <div style="border-top: 1px solid var(--border-color); padding-top: 14px;">
        <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center; background: #0284c7;" 
                onclick="AdvancedModules.addKGToStudyPlan('${node.id}', '${escapeHtml(node.label)}')">
          📅 Add to Adaptive Study Planner
        </button>
      </div>
    `;
  }

  function closeKGPanel() {
    const placeholder = document.getElementById('kg-panel-placeholder');
    const content = document.getElementById('kg-panel-content');
    if (placeholder) placeholder.style.display = 'block';
    if (content) content.style.display = 'none';
  }

  function toggleKGView() {
    const visual = document.getElementById('kg-visual-container');
    const table = document.getElementById('kg-table-container');
    const btn = document.getElementById('btn-kg-toggle-view');
    if (!visual || !table) return;

    if (visual.style.display === 'none') {
      visual.style.display = 'flex';
      table.style.display = 'none';
      if (btn) btn.textContent = '📋 View Accessible Table';
    } else {
      visual.style.display = 'none';
      table.style.display = 'block';
      if (btn) btn.textContent = '🕸️ View Interactive Graph';
    }
  }

  function resetKGZoom() {
    const svgHost = document.getElementById('kg-svg-host');
    if (svgHost) {
      svgHost.scrollLeft = 0;
      svgHost.scrollTop = 0;
    }
    showToast('Knowledge Graph view reset.', 'info');
  }

  function filterKGNodes() {
    const select = document.getElementById('kg-category-filter');
    if (!select || !window._kgData) return;
    const cat = select.value;

    const nodes = cat === 'all' 
      ? window._kgData.nodes 
      : window._kgData.nodes.filter(n => n.node_type === cat);

    renderKGSVG(nodes, window._kgData.edges, window._kgData.weakConceptIds);
  }

  async function addKGToStudyPlan(nodeId, label) {
    if (!window._kgData?.studentId) {
      showToast(`Selected "${label}". Open Adaptive Study Planner to create a personalized study task.`, 'info');
      return;
    }
    try {
      const res = await apiCall('/study-planner/task', 'POST', {
        student_id: window._kgData.studentId,
        topic_name: `Revision: ${label}`,
        subject_id: null,
        priority: 'High',
        estimated_hours: 3.0,
        target_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      });
      if (res && res.success) {
        showToast(`Added "${label}" as a high-priority task in your Adaptive Study Planner!`, 'success');
      } else {
        showToast(res?.message || 'Failed to add study task.', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // =========================================================================
  // 2. ACADEMIC TRAJECTORY PREDICTOR
  // =========================================================================
  async function initTrajectoryPredictor(containerEl, studentId) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Calculating transparent academic trajectory prediction...</div>
      </div>
    `;

    try {
      const res = await apiCall(`/trajectory/predict/${studentId}`);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to calculate trajectory.');
      }

      const p = res.data;

      // Handle insufficient data state cleanly
      if (p.is_insufficient_data) {
        containerEl.innerHTML = `
          <div class="module-hero-banner purple">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 1.4rem;">📈</span>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Academic Trajectory Predictor</h2>
                <span class="rule-engine-tag" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; border-color: rgba(168, 85, 247, 0.3);">
                  STATISTICAL OLS REGRESSION
                </span>
              </div>
              <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
                Provides transparent, explainable statistical performance projections based strictly on historical assessment marks and attendance records.
              </p>
            </div>
          </div>

          <div class="glass-card" style="padding: 36px 24px; text-align: center; border-left: 4px solid var(--accent-gold);">
            <div style="font-size: 2.2rem; margin-bottom: 10px;">📉</div>
            <h3 style="font-size: 1.2rem; font-weight: 700; color: #fff;">${escapeHtml(p.notes)}</h3>
            <p style="color: var(--text-muted); font-size: 0.88rem; max-width: 580px; margin: 8px auto 18px;">
              ${escapeHtml(p.methodology?.transparency_notice)}
            </p>
            <div style="display: inline-flex; gap: 12px; font-size: 0.82rem; background: var(--bg-surface-subtle); padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border-color);">
              <span>Available Data Points: <strong>${p.data_points_count}</strong></span>
              <span>•</span>
              <span>Current Recorded GPA: <strong>${p.current_baseline_gpa ?? 'N/A'}</strong></span>
            </div>
          </div>
        `;
        return;
      }

      const trendColor = p.trajectory_direction === 'Upward Trend' ? '#10b981' : (p.trajectory_direction === 'Downward Trend' ? '#f43f5e' : '#38bdf8');
      const trendIcon = p.trajectory_direction === 'Upward Trend' ? '↗' : (p.trajectory_direction === 'Downward Trend' ? '↘' : '→');

      containerEl.innerHTML = `
        <div class="module-hero-banner purple">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">📈</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Academic Trajectory Predictor</h2>
              <span class="rule-engine-tag" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; border-color: rgba(168, 85, 247, 0.3);">
                ${escapeHtml(p.methodology.model_type)}
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Transparent statistical estimation computed using Ordinary Least Squares linear trend analysis, weighted internal assessments, and attendance compliance factors.
            </p>
          </div>
          <div style="text-align: right;">
            <span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-weight: 700; padding: 6px 12px;">
              ${escapeHtml(p.methodology.confidence_band)}
            </span>
          </div>
        </div>

        <!-- Metric Grid -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 24px;">
          <!-- Projected Range Card -->
          <div class="stat-card" style="border-top: 3px solid #a855f7;">
            <div class="stat-label">PROJECTED SEMESTER GPA RANGE</div>
            <div class="stat-value" style="color: #c084fc;">
              ${p.projected_gpa_range.lower} – ${p.projected_gpa_range.upper}
            </div>
            <div class="stat-meta">
              <span>Point estimate: <strong>${p.projected_gpa}</strong></span>
              <span style="color: var(--text-dim);"> (±${p.projected_gpa_range.margin_of_error})</span>
            </div>
          </div>

          <!-- Trend Direction Card -->
          <div class="stat-card" style="border-top: 3px solid ${trendColor};">
            <div class="stat-label">HISTORICAL TRAJECTORY DIRECTION</div>
            <div class="stat-value" style="color: ${trendColor};">
              ${trendIcon} ${escapeHtml(p.trajectory_direction)}
            </div>
            <div class="stat-meta">
              <span>Slope: <strong>${p.linear_trend_slope > 0 ? '+' : ''}${p.linear_trend_slope}/period</strong></span>
            </div>
          </div>

          <!-- Baseline GPA -->
          <div class="stat-card" style="border-top: 3px solid #38bdf8;">
            <div class="stat-label">CURRENT RECORDED BASELINE GPA</div>
            <div class="stat-value" style="color: #38bdf8;">
              ${p.current_baseline_gpa ?? 'N/A'}
            </div>
            <div class="stat-meta">
              <span>Based on ${p.data_points_count} validated assessments</span>
            </div>
          </div>

          <!-- Attendance Compliance -->
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <div class="stat-label">ATTENDANCE COMPLIANCE FACTOR</div>
            <div class="stat-value" style="color: #10b981;">
              ${p.attendance_percentage}%
            </div>
            <div class="stat-meta">
              <span class="badge ${p.attendance_percentage >= 75 ? 'badge-success' : 'badge-danger'}">
                ${p.attendance_percentage >= 75 ? 'Above Mandatory 75%' : 'Critical: Below 75%'}
              </span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
          <!-- Explainable Contributing Factors -->
          <div class="glass-card" style="padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 16px;">
              🔍 Explainable Contributing Factors
            </h3>

            <div class="factor-bar-wrapper">
              <div class="factor-bar-header">
                <span>Continuous Internal Assessments (Weight: 40%)</span>
                <strong>Score: ${p.contributing_factors.internal_assessment_factor.score}%</strong>
              </div>
              <div class="factor-progress-bg">
                <div class="factor-progress-fill" style="width: ${p.contributing_factors.internal_assessment_factor.score}%; background: #a855f7;"></div>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 3px;">
                Average mark across internal tests and lab continuous evaluations.
              </div>
            </div>

            <div class="factor-bar-wrapper">
              <div class="factor-bar-header">
                <span>Historical Momentum & Slope (Weight: 35%)</span>
                <strong>GPA Momentum: ${p.contributing_factors.historical_momentum_factor.score}</strong>
              </div>
              <div class="factor-progress-bg">
                <div class="factor-progress-fill" style="width: ${Math.min(100, (p.contributing_factors.historical_momentum_factor.score / 10) * 100)}%; background: #38bdf8;"></div>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 3px;">
                Calculated slope across chronological semester examinations.
              </div>
            </div>

            <div class="factor-bar-wrapper">
              <div class="factor-bar-header">
                <span>Attendance Compliance Impact (Weight: 25%)</span>
                <strong>${p.contributing_factors.attendance_compliance_factor.score}%</strong>
              </div>
              <div class="factor-progress-bg">
                <div class="factor-progress-fill" style="width: ${p.contributing_factors.attendance_compliance_factor.score}%; background: ${p.attendance_percentage >= 75 ? '#10b981' : '#f43f5e'};"></div>
              </div>
              <div style="font-size: 0.74rem; color: var(--text-dim); margin-top: 3px;">
                Mandatory institutional attendance threshold is 75.0%.
              </div>
            </div>
          </div>

          <!-- Suggested Actionable Next Steps -->
          <div class="glass-card" style="padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 16px;">
              🎯 Recommended Next Actions
            </h3>
            <ul style="padding-left: 20px; font-size: 0.86rem; color: var(--text-muted); line-height: 1.6;">
              ${p.suggested_actions.map(act => `<li style="margin-bottom: 8px;">${escapeHtml(act)}</li>`).join('')}
            </ul>

            <div class="rule-evidence-box" style="margin-top: 18px;">
              <strong>Scientific & Statistical Disclaimer:</strong><br/>
              ${escapeHtml(p.methodology.transparency_notice)}
            </div>
          </div>
        </div>
      `;

    } catch (err) {
      console.error('[Trajectory Predictor Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Prediction Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  // =========================================================================
  // 3. ADAPTIVE STUDY PLANNER
  // =========================================================================
  async function initStudyPlanner(containerEl, studentId) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Loading Adaptive Study Planner and priority tasks...</div>
      </div>
    `;

    try {
      const res = await apiCall(`/study-planner/${studentId}`);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to load Study Planner.');
      }

      const { plan, tasks, summary, weakSubjects } = res.data;

      containerEl.innerHTML = `
        <div class="module-hero-banner emerald">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">📅</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Adaptive Study Planner</h2>
              <span class="rule-engine-tag" style="background: rgba(16 juvenile, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3);">
                PREREQUISITE-PRIORITIZED REVISION
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Dynamic weekly study workload planner connected directly to your Academic Knowledge Graph weakness areas and semester examination targets.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary btn-sm" style="background: #059669;" onclick="AdvancedModules.openAddStudyTaskModal(${studentId})">
              ➕ Add Study Task
            </button>
          </div>
        </div>

        <!-- Weekly Progress Header -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <div class="stat-label">WEEKLY GOAL TARGET</div>
            <div class="stat-value" style="color: #10b981;">${plan?.weekly_goal_hours || 12.0} hrs</div>
            <div class="stat-meta"><span>Allocated study budget</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #38bdf8;">
            <div class="stat-label">TASK COMPLETION RATE</div>
            <div class="stat-value" style="color: #38bdf8;">${summary.completionRatePct}%</div>
            <div class="stat-meta"><span>${summary.completedTasks} of ${summary.totalTasks} tasks done</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f59e0b;">
            <div class="stat-label">IN PROGRESS</div>
            <div class="stat-value" style="color: #f59e0b;">${summary.inProgressTasks}</div>
            <div class="stat-meta"><span>Active revision topics</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f43f5e;">
            <div class="stat-label">NOT STARTED</div>
            <div class="stat-value" style="color: #f43f5e;">${summary.notStartedTasks}</div>
            <div class="stat-meta"><span>Pending study items</span></div>
          </div>
        </div>

        ${weakSubjects && weakSubjects.length > 0 ? `
          <div class="glass-card" style="margin-bottom: 20px; padding: 14px 20px; border-left: 4px solid #f59e0b;">
            <div style="font-weight: 700; color: #f59e0b; font-size: 0.88rem; margin-bottom: 4px;">
              📌 Weak Subjects Identified for Focus:
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted);">
              ${weakSubjects.map(s => `<strong>${escapeHtml(s.subject_name)}</strong> (${s.avg_pct}% in ${s.assessment_type})`).join(' • ')}
            </div>
          </div>
        ` : ''}

        <!-- Task List Header & Filter -->
        <div class="glass-card" style="padding: 22px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 10px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff;">Scheduled Study Topics</h3>
            <span style="font-size: 0.8rem; color: var(--text-dim);">Tap buttons below to mark task status</span>
          </div>

          <div id="study-task-list-container">
            ${tasks.length === 0 ? `
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div style="font-size: 2rem; margin-bottom: 8px;">📝</div>
                <div>No study tasks scheduled yet.</div>
                <div style="font-size: 0.82rem; margin-top: 4px;">Click "Add Study Task" to begin your adaptive revision plan.</div>
              </div>
            ` : tasks.map(t => {
              const isDone = t.status === 'Completed';
              return `
                <div class="study-task-card ${isDone ? 'completed' : ''}" id="study-task-${t.id}">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <span class="priority-tag ${t.priority || 'Medium'}">${t.priority || 'Medium'}</span>
                      <strong style="color: #fff; font-size: 0.95rem; text-decoration: ${isDone ? 'line-through' : 'none'};">
                        ${escapeHtml(t.topic_name)}
                      </strong>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-dim);">
                      ${t.subject_name ? `Subject: ${escapeHtml(t.subject_name)} | ` : ''}
                      Est. Time: ${t.estimated_hours} hrs ${t.completed_hours ? `(Done: ${t.completed_hours} hrs)` : ''}
                      ${t.target_date ? `| Target: ${new Date(t.target_date).toLocaleDateString()}` : ''}
                    </div>
                  </div>

                  <!-- Status Action Buttons -->
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <select class="form-input" style="padding: 4px 8px; font-size: 0.78rem; width: auto;" 
                            onchange="AdvancedModules.updateTaskStatus(${t.id}, this.value, ${studentId})">
                      <option value="Not Started" ${t.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                      <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                      <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    </select>
                    <button class="btn btn-secondary btn-xs" style="color: #f43f5e;" onclick="AdvancedModules.deleteStudyTask(${t.id}, ${studentId})">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      window._studyPlannerData = { plan, tasks, studentId };

    } catch (err) {
      console.error('[Study Planner Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Study Planner Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  async function updateTaskStatus(taskId, newStatus, studentId) {
    try {
      const res = await apiCall(`/study-planner/task/${taskId}`, 'PUT', { status: newStatus });
      if (res && res.success) {
        showToast(`Task updated to ${newStatus}.`, 'success');
        // Re-render planner
        const host = document.getElementById('view-study-planner') || document.getElementById('planner-host');
        if (host) initStudyPlanner(host, studentId);
      } else {
        showToast(res?.message || 'Failed to update task status.', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function deleteStudyTask(taskId, studentId) {
    if (!confirm('Are you sure you want to remove this study task?')) return;
    try {
      const res = await apiCall(`/study-planner/task/${taskId}`, 'DELETE');
      if (res && res.success) {
        showToast('Study task removed.', 'info');
        const host = document.getElementById('view-study-planner') || document.getElementById('planner-host');
        if (host) initStudyPlanner(host, studentId);
      } else {
        showToast(res?.message || 'Failed to remove task.', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function openAddStudyTaskModal(studentId) {
    const existing = document.getElementById('add-task-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-overlay active" id="add-task-modal">
        <div class="modal-card glass-card" style="max-width: 480px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff;">➕ Add Adaptive Study Task</h3>
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('add-task-modal').remove()">✕</button>
          </div>
          <form id="add-study-task-form" onsubmit="event.preventDefault(); AdvancedModules.submitNewStudyTask(${studentId});">
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label">Topic / Concept Name *</label>
              <input type="text" class="form-input" id="new-task-topic" required placeholder="e.g. Dynamic Programming & Memoization">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-input" id="new-task-priority">
                  <option value="High">High Priority</option>
                  <option value="Medium" selected>Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Estimated Hours</label>
                <input type="number" class="form-input" id="new-task-hours" value="2.5" step="0.5" min="0.5" max="40">
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 18px;">
              <label class="form-label">Target Completion Date</label>
              <input type="date" class="form-input" id="new-task-date">
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('add-task-modal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm" style="background: #059669;">Create Task</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  async function submitNewStudyTask(studentId) {
    const topic = document.getElementById('new-task-topic')?.value?.trim();
    const priority = document.getElementById('new-task-priority')?.value || 'Medium';
    const hours = parseFloat(document.getElementById('new-task-hours')?.value || 2);
    const date = document.getElementById('new-task-date')?.value || null;

    if (!topic) {
      showToast('Please specify a topic name.', 'error');
      return;
    }

    try {
      const res = await apiCall('/study-planner/task', 'POST', {
        student_id: studentId,
        topic_name: topic,
        priority,
        estimated_hours: hours,
        target_date: date
      });

      if (res && res.success) {
        showToast('Study task created successfully!', 'success');
        document.getElementById('add-task-modal')?.remove();
        const host = document.getElementById('view-study-planner') || document.getElementById('planner-host');
        if (host) initStudyPlanner(host, studentId);
      } else {
        showToast(res?.message || 'Failed to create study task.', 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // =========================================================================
  // 4. SKILL EVIDENCE GRAPH
  // =========================================================================
  async function initSkillEvidence(containerEl, studentId) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Connecting verified academic evidence to career skill requirements...</div>
      </div>
    `;

    try {
      const res = await apiCall(`/skill-evidence/${studentId}`);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to load Skill Evidence Graph.');
      }

      const { student, targetRole, roles, skills, evidence, careerGapAnalysis, summary } = res.data;

      containerEl.innerHTML = `
        <div class="module-hero-banner amber">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">🌟</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Skill Evidence Graph</h2>
              <span class="rule-engine-tag" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">
                VALIDATED PORTFOLIO COMPETENCIES
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Bridges verified coursework, NPTEL certificates, hackathons, and IEEE accomplishments directly to industry career profiles. Only authenticated records award verified competency.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">TARGET CAREER:</label>
            <select class="form-input" id="target-career-selector" style="width: auto; padding: 6px 12px; font-size: 0.85rem;" 
                    onchange="AdvancedModules.switchCareerRole(this.value, ${studentId})">
              ${roles.map(r => `
                <option value="${escapeHtml(r.role)}" ${r.role === targetRole ? 'selected' : ''}>
                  ${escapeHtml(r.role)} (${r.coveragePct}% match)
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- Metric Grid -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="border-top: 3px solid #f59e0b;">
            <div class="stat-label">TARGET ROLE FIT</div>
            <div class="stat-value" style="color: #f59e0b;">${summary.coveragePct}%</div>
            <div class="stat-meta"><span>${escapeHtml(targetRole)}</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <div class="stat-label">VERIFIED SKILLS</div>
            <div class="stat-value" style="color: #10b981;">${summary.verifiedSkillsCount}</div>
            <div class="stat-meta"><span>Of ${summary.totalSkillsTracked} total tracked</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #38bdf8;">
            <div class="stat-label">EVIDENCE ARTIFACTS</div>
            <div class="stat-value" style="color: #38bdf8;">${evidence.length}</div>
            <div class="stat-meta"><span>${summary.verifiedEvidenceCount} verified by staff</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f43f5e;">
            <div class="stat-label">SKILL GAPS</div>
            <div class="stat-value" style="color: #f43f5e;">${careerGapAnalysis.missingSkills.length}</div>
            <div class="stat-meta"><span>Needs academic evidence</span></div>
          </div>
        </div>

        <!-- Career Gap & Evidence Two-Column Layout -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px;">
          <!-- Competency Status -->
          <div class="glass-card" style="padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 14px;">
              🎯 Required Competencies for ${escapeHtml(targetRole)}
            </h3>

            ${careerGapAnalysis.acquiredSkills.length > 0 ? `
              <div style="margin-bottom: 14px;">
                <div style="font-size: 0.78rem; font-weight: 700; color: #10b981; margin-bottom: 6px;">
                  ✓ ACQUIRED & DEMONSTRATED SKILLS (${careerGapAnalysis.acquiredSkills.length}):
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  ${careerGapAnalysis.acquiredSkills.map(s => `
                    <span class="evidence-badge verified">✓ ${escapeHtml(s)}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${careerGapAnalysis.missingSkills.length > 0 ? `
              <div>
                <div style="font-size: 0.78rem; font-weight: 700; color: #f43f5e; margin-bottom: 6px;">
                  ⚠️ UNACQUIRED COMPETENCY GAPS (${careerGapAnalysis.missingSkills.length}):
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                  ${careerGapAnalysis.missingSkills.map(s => `
                    <span class="evidence-badge pending" style="cursor: pointer;" onclick="AdvancedModules.addGapToStudyPlan('${escapeHtml(s)}', ${studentId})">
                      + Plan ${escapeHtml(s)}
                    </span>
                  `).join('')}
                </div>
                <div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 8px;">
                  💡 Click any missing skill pill to add a dedicated revision task into your Study Planner.
                </div>
              </div>
            ` : '<div style="color: #10b981; font-size: 0.85rem;">🎉 100% of core competencies for this role are verified!</div>'}
          </div>

          <!-- Verified Evidence Records -->
          <div class="glass-card" style="padding: 22px;">
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 14px;">
              📜 Demonstrated Evidence Records
            </h3>

            ${evidence.length === 0 ? `
              <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
                No external activities or certifications submitted yet.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto;">
                ${evidence.map(ev => `
                  <div style="background: var(--bg-surface-subtle); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                      <strong style="color: #fff; font-size: 0.88rem;">${escapeHtml(ev.title)}</strong>
                      <span class="evidence-badge ${ev.status === 'Verified' ? 'verified' : (ev.status === 'Pending' ? 'pending' : 'self')}">
                        ${escapeHtml(ev.status)}
                      </span>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 6px;">
                      Category: ${escapeHtml(ev.category)} | Date: ${new Date(ev.date).toLocaleDateString()}
                      ${ev.verified_by_name ? ` | Verified by: ${escapeHtml(ev.verified_by_name)}` : ''}
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                      ${(ev.skills || []).map(sk => `<span class="badge badge-secondary" style="font-size: 0.7rem;">${escapeHtml(sk)}</span>`).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;

    } catch (err) {
      console.error('[Skill Evidence Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Skill Evidence Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  function addGapToStudyPlan(skillName, studentId) {
    AdvancedModules.addKGToStudyPlan('skill-gap', `Skill Gap Mastery: ${skillName}`);
  }

  // =========================================================================
  // 5. INSTITUTION DEPARTMENT MINI DASHBOARDS (PHASE 2 & 4)
  // =========================================================================
  async function initDepartmentMiniDashboards(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Aggregating real institutional department mini-dashboards...</div>
      </div>
    `;

    try {
      const res = await apiCall('/departments/mini-dashboards');
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to aggregate department mini-dashboards.');
      }

      const departments = res.data || [];

      containerEl.innerHTML = `
        <div class="module-hero-banner cyan">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">🏢</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Department-Wise Mini Dashboards</h2>
              <span class="rule-engine-tag" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.3);">
                REAL-TIME AGGREGATION & AUDIT
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Institution-wide performance overview aggregated directly from live database records. Click "View Student Mini Dashboards" on any department card to inspect individual student profiles, mentor allocations, and academic standings.
            </p>
          </div>
          <div style="font-weight: 700; font-size: 1.1rem; color: #38bdf8;">
            ${departments.length} Active Departments
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px; margin-bottom: 24px;" id="dept-cards-grid">
          ${departments.map(d => `
            <div class="glass-card" style="padding: 22px; border-top: 3px solid #38bdf8; transition: transform 0.2s;" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='none'">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                  <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff;">${escapeHtml(d.name)}</h3>
                  <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 2px;">
                    Department Code: <code>${escapeHtml(d.code)}</code>
                  </div>
                </div>
                <span class="badge badge-primary">${d.studentCount} Students</span>
              </div>

              <!-- HOD Status -->
              <div style="background: var(--bg-surface-subtle); padding: 8px 12px; border-radius: 6px; margin-bottom: 14px; font-size: 0.8rem; border: 1px solid var(--border-color);">
                <div style="color: var(--text-dim); font-size: 0.72rem; text-transform: uppercase; font-weight: 700;">Head of Department</div>
                <div style="font-weight: 600; color: #fff; margin-top: 2px;">
                  ${d.hod ? `👑 ${escapeHtml(d.hod.name)} (${escapeHtml(d.hod.code)})` : '<span style="color: var(--accent-rose);">⚠️ No Active HOD Appointed</span>'}
                </div>
              </div>

              <!-- Metrics Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                <div style="background: var(--bg-surface-subtle); padding: 8px 10px; border-radius: 6px;">
                  <div style="font-size: 0.72rem; color: var(--text-dim);">AVERAGE CGPA</div>
                  <div style="font-size: 1.1rem; font-weight: 700; color: #38bdf8;">${d.academicPerformance.averageCgpa || '0.00'}</div>
                </div>
                <div style="background: var(--bg-surface-subtle); padding: 8px 10px; border-radius: 6px;">
                  <div style="font-size: 0.72rem; color: var(--text-dim);">AVG ATTENDANCE</div>
                  <div style="font-size: 1.1rem; font-weight: 700; color: #10b981;">${d.attendance.average}%</div>
                </div>
              </div>

              <!-- Risk & Follow up status -->
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 12px; color: var(--text-muted);">
                <span>Students Needing Follow-up:</span>
                <span class="delta-pill ${d.studentsRequiringFollowUp > 0 ? 'negative' : 'positive'}">
                  ${d.studentsRequiringFollowUp} students
                </span>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 14px; color: var(--text-muted);">
                <span>Fee Collection Rate:</span>
                <strong style="color: #fff;">${d.feeCollection.collectionRatePct}% (${formatINR(d.feeCollection.totalPaid)})</strong>
              </div>

              <!-- Action: Open Student Mini Dashboards -->
              <button class="btn btn-primary btn-sm" style="width: 100%; justify-content: center; background: #0284c7;" 
                      onclick="AdvancedModules.openDepartmentStudentDrilldown(${d.id}, '${escapeHtml(d.name)}')">
                👥 View Student Mini Dashboards (${d.studentCount})
              </button>
            </div>
          `).join('')}
        </div>

        <!-- Student Mini Dashboards Modal / Host -->
        <div id="dept-student-drilldown-host"></div>
      `;

    } catch (err) {
      console.error('[Department Mini Dashboards Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Mini Dashboards Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  async function openDepartmentStudentDrilldown(departmentId, departmentName) {
    const host = document.getElementById('dept-student-drilldown-host');
    if (!host) return;

    host.innerHTML = `
      <div class="modal-overlay active" id="dept-drilldown-modal">
        <div class="modal-card glass-card" style="max-width: 960px; max-height: 85vh; overflow-y: auto; padding: 26px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: #fff;">${escapeHtml(departmentName)} — Student Mini Dashboards</h3>
              <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 2px;">Database records for students registered in this department</div>
            </div>
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('dept-drilldown-modal').remove()">✕ Close</button>
          </div>

          <div style="padding: 30px; text-align: center; color: var(--text-muted);" id="dept-students-spinner">
            <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
            <div>Retrieving department student profiles and academic standing...</div>
          </div>

          <div id="dept-students-content" style="display: none;"></div>
        </div>
      </div>
    `;

    try {
      const res = await apiCall(`/departments/${departmentId}/student-mini-dashboards`);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to retrieve department students.');
      }

      const students = res.data || [];
      const spinner = document.getElementById('dept-students-spinner');
      const content = document.getElementById('dept-students-content');
      if (spinner) spinner.style.display = 'none';
      if (content) content.style.display = 'block';

      if (students.length === 0) {
        content.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted);">No active students enrolled in this department.</div>';
        return;
      }

      content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          ${students.map(s => `
            <div class="glass-card" style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <img src="${s.avatar || 'assets/default-avatar.svg'}" style="width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border-color);" alt="avatar">
                <div style="flex: 1; min-width: 0;">
                  <strong style="color: #fff; font-size: 0.9rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${escapeHtml(s.name)}
                  </strong>
                  <span style="font-size: 0.76rem; color: var(--text-dim); font-family: monospace;">${escapeHtml(s.registerNumber)}</span>
                </div>
              </div>

              <!-- Stats Pill Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; font-size: 0.78rem;">
                <div style="background: var(--bg-surface-subtle); padding: 6px 8px; border-radius: 4px;">
                  <span style="color: var(--text-dim);">CGPA:</span> <strong>${s.cgpa !== null ? s.cgpa : 'N/A'}</strong>
                </div>
                <div style="background: var(--bg-surface-subtle); padding: 6px 8px; border-radius: 4px;">
                  <span style="color: var(--text-dim);">Attendance:</span> <strong style="color: ${s.attendancePercentage >= 75 ? '#10b981' : '#f43f5e'};">${s.attendancePercentage !== null ? s.attendancePercentage + '%' : 'N/A'}</strong>
                </div>
              </div>

              <!-- Mentor & Activities -->
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 6px;">
                Mentor: ${s.mentor ? `<strong>${escapeHtml(s.mentor.name)}</strong>` : '<span style="color: var(--accent-rose);">Unassigned</span>'}
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 10px;">
                Verified Activities: <strong>${s.verifiedActivitiesCount}</strong> | Active Interventions: <strong>${s.intervention.activeCount}</strong>
              </div>

              <!-- Fee Status -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 0.76rem;">
                <span style="color: var(--text-dim);">Fee Status:</span>
                <span class="badge ${s.fees.status === 'Paid' ? 'badge-success' : 'badge-danger'}">${escapeHtml(s.fees.status)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

    } catch (err) {
      console.error('[Student Drilldown Error]', err);
      const content = document.getElementById('dept-students-content');
      if (content) {
        content.style.display = 'block';
        content.innerHTML = `<div style="color: var(--accent-rose); text-align: center; padding: 20px;">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  // =========================================================================
  // 6. SIMULATED DEMO PAYMENT WORKFLOW (PHASE 8)
  // =========================================================================
  async function initDemoPaymentWorkflow(containerEl, studentId) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Loading verified fee records and demo checkout simulation...</div>
      </div>
    `;

    try {
      const res = await apiCall(`/fees/student/${studentId}`);
      if (!res || !res.success) {
        throw new Error(res?.message || 'Failed to load student fee records.');
      }

      const { fees, payments, summary } = res.data;

      containerEl.innerHTML = `
        <div class="module-hero-banner rose">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">💳</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Fee Status & Demo Payment Simulation</h2>
              <span class="demo-payment-badge">
                DEMO — NO REAL MONEY
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Interactive simulation of student fee payment workflows. No real bank accounts, cards, or monetary transfers occur. Atomic database locking prevents double-credit.
            </p>
          </div>
        </div>

        <!-- Summary Metric Cards -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="border-top: 3px solid #38bdf8;">
            <div class="stat-label">TOTAL ACCRUED FEES</div>
            <div class="stat-value" style="color: #38bdf8;">${formatINR(summary.totalDue)}</div>
            <div class="stat-meta"><span>Current academic ledger</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <div class="stat-label">TOTAL PAID AMOUNT</div>
            <div class="stat-value" style="color: #10b981;">${formatINR(summary.totalPaid)}</div>
            <div class="stat-meta"><span>Validated demo receipts</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f43f5e;">
            <div class="stat-label">OUTSTANDING BALANCE</div>
            <div class="stat-value" style="color: #f43f5e;">${formatINR(summary.totalBalance)}</div>
            <div class="stat-meta"><span>${summary.totalBalance > 0 ? 'Payment required' : 'Fully settled'}</span></div>
          </div>
        </div>

        <!-- Fee Items Ledger -->
        <div class="glass-card" style="padding: 22px; margin-bottom: 24px;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 16px;">
            Academic Fee Schedules & Outstanding Balance
          </h3>

          <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 6px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Academic Period</th>
                  <th>Total Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Simulated Action</th>
                </tr>
              </thead>
              <tbody>
                ${fees.length === 0 ? `
                  <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No fee obligations found in database.</td></tr>
                ` : fees.map(f => `
                  <tr>
                    <td><strong>${escapeHtml(f.fee_category)}</strong></td>
                    <td>${escapeHtml(f.academic_year)} (${escapeHtml(f.semester)})</td>
                    <td>${formatINR(f.total_amount)}</td>
                    <td style="color: #10b981;">${formatINR(f.paid_amount)}</td>
                    <td style="color: ${f.balance_amount > 0 ? '#f43f5e' : '#10b981'}; font-weight: 700;">
                      ${formatINR(f.balance_amount)}
                    </td>
                    <td>
                      <span class="badge ${f.status === 'Paid' ? 'badge-success' : (f.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger')}">
                        ${escapeHtml(f.status)}
                      </span>
                    </td>
                    <td>
                      ${f.balance_amount > 0 ? `
                        <button class="btn btn-primary btn-xs" style="background: #f43f5e;" 
                                onclick="AdvancedModules.openSimulatedCheckout(${f.id}, '${escapeHtml(f.fee_category)}', ${f.balance_amount}, ${studentId})">
                          💳 Pay Now — Demo
                        </button>
                      ` : `
                        <button class="btn btn-secondary btn-xs" onclick="AdvancedModules.viewFeeInvoice(${f.id})">
                          🧾 Invoice
                        </button>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Transaction History -->
        <div class="glass-card" style="padding: 22px;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 16px;">
            Simulated Demo Payment Receipts & History
          </h3>

          <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 6px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Transaction Ref</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Simulated Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                ${payments.length === 0 ? `
                  <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No simulated payment transactions recorded yet.</td></tr>
                ` : payments.map(p => `
                  <tr>
                    <td><code>${escapeHtml(p.transaction_ref)}</code></td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(p.payment_date).toLocaleString()}</td>
                    <td>${escapeHtml(p.fee_category || 'Academic Fee')}</td>
                    <td>${escapeHtml(p.payment_method)}</td>
                    <td><strong>${formatINR(p.amount)}</strong></td>
                    <td>
                      <span class="badge ${p.status === 'Success' ? 'badge-success' : (p.status === 'Pending' ? 'badge-warning' : 'badge-danger')}">
                        ${escapeHtml(p.status)}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-xs" onclick="AdvancedModules.viewTransactionReceipt('${p.transaction_ref}')">
                        Receipt
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Checkout Simulation Modal Container -->
        <div id="simulated-checkout-modal-host"></div>
      `;

    } catch (err) {
      console.error('[Demo Payment Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Fee Status Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  function openSimulatedCheckout(feeId, category, balanceAmount, studentId) {
    const host = document.getElementById('simulated-checkout-modal-host') || document.body;
    const existing = document.getElementById('demo-checkout-modal');
    if (existing) existing.remove();

    const modalHtml = `
      <div class="modal-overlay active" id="demo-checkout-modal">
        <div class="modal-card demo-payment-box" style="max-width: 520px;">
          <!-- Prominent Simulation Notice -->
          <div style="background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.4); padding: 12px 16px; border-radius: 6px; margin-bottom: 18px; text-align: center;">
            <div style="color: #f43f5e; font-weight: 800; font-size: 0.88rem; letter-spacing: 0.5px;">
              ⚠️ SIMULATED CHECKOUT — DEMO ONLY
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">
              NO REAL MONEY, NO LIVE GATEWAY. No card numbers or passwords are required.
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: #fff;">Simulate Fee Payment</h3>
              <div style="font-size: 0.82rem; color: var(--text-dim); margin-top: 2px;">${escapeHtml(category)}</div>
            </div>
            <button class="btn btn-secondary btn-xs" onclick="document.getElementById('demo-checkout-modal').remove()">✕</button>
          </div>

          <!-- Payment Summary -->
          <div style="background: var(--bg-surface-subtle); padding: 14px 18px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem; color: var(--text-muted);">
              <span>Outstanding Balance:</span>
              <span>${formatINR(balanceAmount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; color: #fff;">
              <span>Simulated Payment Amount:</span>
              <span style="color: #10b981;">${formatINR(balanceAmount)}</span>
            </div>
          </div>

          <!-- Simulated Method Selector -->
          <div class="form-group" style="margin-bottom: 16px;">
            <label class="form-label">Select Simulated Payment Method</label>
            <select class="form-input" id="demo-pay-method">
              <option value="Simulated UPI (Auto-Approved Demo)">Simulated UPI (Auto-Approved Demo)</option>
              <option value="Simulated Debit Card (Visa Sandbox)">Simulated Debit Card (Visa Sandbox)</option>
              <option value="Simulated Net-Banking (College Test Clearing)">Simulated Net-Banking (College Test Clearing)</option>
            </select>
          </div>

          <!-- Simulation Outcome Controllers -->
          <div style="margin-bottom: 20px;">
            <label class="form-label" style="display: block; margin-bottom: 6px;">Select Desired Gateway Outcome:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
              <button class="btn btn-primary btn-sm" style="background: #10b981; font-weight: 700; justify-content: center;"
                      onclick="AdvancedModules.executeDemoPayment(${feeId}, ${balanceAmount}, 'Success', ${studentId})">
                ✓ Success
              </button>
              <button class="btn btn-secondary btn-sm" style="color: #f43f5e; font-weight: 700; justify-content: center;"
                      onclick="AdvancedModules.executeDemoPayment(${feeId}, ${balanceAmount}, 'Failed', ${studentId})">
                ✕ Decline
              </button>
              <button class="btn btn-secondary btn-sm" style="color: #94a3b8; font-weight: 700; justify-content: center;"
                      onclick="AdvancedModules.executeDemoPayment(${feeId}, ${balanceAmount}, 'Cancelled', ${studentId})">
                🚫 Cancel
              </button>
            </div>
          </div>

          <div style="text-align: center; font-size: 0.74rem; color: var(--text-dim);">
            Transactions are recorded atomically in the database and audit logs for verification.
          </div>
        </div>
      </div>
    `;

    host.insertAdjacentHTML('beforeend', modalHtml);
  }

  async function executeDemoPayment(feeId, amount, simulatedOutcome, studentId) {
    const modal = document.getElementById('demo-checkout-modal');
    const method = document.getElementById('demo-pay-method')?.value || 'Demo Simulation';

    const idempotencyKey = `demo-${feeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      showToast(`Initiating simulated ${simulatedOutcome} transaction...`, 'info');

      const res = await apiCall('/fees/pay', 'POST', {
        feeId,
        amount,
        payment_method: method,
        outcome: simulatedOutcome,
        idempotency_key: idempotencyKey
      });

      if (modal) modal.remove();

      if (simulatedOutcome === 'Success' && res && res.success) {
        showToast('Demo payment successful! Fee ledger updated.', 'success');
        AdvancedModules.viewTransactionReceipt(res.transactionRef);
      } else if (simulatedOutcome === 'Cancelled') {
        showToast('Demo payment safely cancelled by user.', 'info');
      } else {
        showToast(res?.message || 'Simulated payment was declined as requested.', 'error');
      }

      // Re-render student fee view
      const feeHost = document.getElementById('view-fee-status') || document.getElementById('fee-status-host');
      if (feeHost) initDemoPaymentWorkflow(feeHost, studentId);

    } catch (err) {
      if (modal) modal.remove();
      if (simulatedOutcome === 'Failed') {
        showToast('Simulated gateway failure recorded correctly.', 'info');
        const feeHost = document.getElementById('view-fee-status') || document.getElementById('fee-status-host');
        if (feeHost) initDemoPaymentWorkflow(feeHost, studentId);
      } else {
        showToast(err.message, 'error');
      }
    }
  }

  async function viewTransactionReceipt(transactionRef) {
    try {
      const res = await apiCall(`/fees/receipt/${transactionRef}`);
      if (!res || !res.success) throw new Error(res?.message || 'Receipt not found.');

      const r = res.data;

      const receiptHtml = `
        <div class="modal-overlay active" id="demo-receipt-modal">
          <div class="modal-card demo-receipt-container" style="max-width: 480px;">
            <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 14px;">
              <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">ACADEMIC ATS</h2>
              <div style="font-size: 0.78rem; text-transform: uppercase;">Official Demo Payment Receipt</div>
              <div style="font-size: 0.72rem; color: #dc2626; font-weight: 800; margin-top: 4px;">*** DEMO TRANSACTION — NO REAL VALUE ***</div>
            </div>

            <div style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 14px;">
              <div><strong>Receipt Ref:</strong> ${escapeHtml(r.transactionRef)}</div>
              <div><strong>Date & Time:</strong> ${new Date(r.paymentDate).toLocaleString()}</div>
              <div><strong>Student Name:</strong> ${escapeHtml(r.studentName)}</div>
              <div><strong>Register No:</strong> ${escapeHtml(r.registerNumber)}</div>
              <div><strong>Department:</strong> ${escapeHtml(r.departmentName)}</div>
              <div><strong>Category:</strong> ${escapeHtml(r.feeCategory)} (${escapeHtml(r.academicYear)})</div>
              <div><strong>Method:</strong> ${escapeHtml(r.paymentMethod)}</div>
            </div>

            <div style="border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 10px 0; margin-bottom: 14px; display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800;">
              <span>AMOUNT PAID:</span>
              <span>${formatINR(r.amount)}</span>
            </div>

            <div style="font-size: 0.82rem; margin-bottom: 16px;">
              <div>Remaining Fee Balance: <strong>${formatINR(r.remainingFeeBalance)}</strong></div>
              <div>Ledger Status: <strong>${escapeHtml(r.status)}</strong></div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print Receipt</button>
              <button class="btn btn-primary btn-sm" style="background: #111827;" onclick="document.getElementById('demo-receipt-modal').remove()">Close</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', receiptHtml);

    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function viewFeeInvoice(feeId) {
    try {
      const res = await apiCall(`/fees/invoice/${feeId}`);
      if (!res || !res.success) throw new Error(res?.message || 'Invoice not found.');

      const inv = res.invoice;

      const modalHtml = `
        <div class="modal-overlay active" id="demo-invoice-modal">
          <div class="modal-card demo-receipt-container" style="max-width: 520px;">
            <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 12px; margin-bottom: 14px;">
              <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">INSTITUTIONAL FEE INVOICE</h2>
              <div style="font-size: 0.78rem;">${escapeHtml(res.invoiceNumber)}</div>
            </div>

            <div style="font-size: 0.85rem; line-height: 1.6; margin-bottom: 14px;">
              <div><strong>Student:</strong> ${escapeHtml(inv.student_name)} (${escapeHtml(inv.register_number)})</div>
              <div><strong>Department:</strong> ${escapeHtml(inv.department_name)}</div>
              <div><strong>Category:</strong> ${escapeHtml(inv.fee_category)}</div>
              <div><strong>Academic Year:</strong> ${escapeHtml(inv.academic_year)} (${escapeHtml(inv.semester)})</div>
              <div><strong>Total Amount:</strong> ${formatINR(inv.total_amount)}</div>
              <div><strong>Paid Amount:</strong> ${formatINR(inv.paid_amount)}</div>
              <div><strong>Outstanding Balance:</strong> ${formatINR(inv.balance_amount)}</div>
              <div><strong>Status:</strong> ${escapeHtml(inv.status)}</div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button class="btn btn-primary btn-sm" style="background: #111827;" onclick="document.getElementById('demo-invoice-modal').remove()">Close</button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  // =========================================================================
  // 7. ADMIN RECONCILIATION: DEMO PAYMENT TRANSACTIONS AUDIT TABLE
  // =========================================================================
  async function initDemoPaymentAuditTable(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div class="loading-spinner" style="margin: 0 auto 12px;"></div>
        <div>Auditing demo payment transactions and reconciliation states...</div>
      </div>
    `;

    try {
      const res = await apiCall('/fees/transactions');
      if (!res || !res.success) throw new Error(res?.message || 'Failed to fetch demo transactions.');

      const { stats, data = [] } = res;

      containerEl.innerHTML = `
        <div class="module-hero-banner rose">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">🧾</span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Demo Payment Transactions & Reconciliation</h2>
              <span class="demo-payment-badge">
                SIMULATION AUDIT LEDGER
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.86rem; max-width: 720px;">
              Audit all student simulated payment transactions across departments. Identifies succeeded, declined, and abandoned demo checkouts with direct ledger reconciliation.
            </p>
          </div>
        </div>

        <!-- Stats Bar -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-bottom: 24px;">
          <div class="stat-card" style="border-top: 3px solid #10b981;">
            <div class="stat-label">SUCCESSFUL TRANSACTIONS</div>
            <div class="stat-value" style="color: #10b981;">${stats.successCount}</div>
            <div class="stat-meta"><span>${formatINR(stats.totalSuccessfulAmount)}</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #f43f5e;">
            <div class="stat-label">FAILED / DECLINED</div>
            <div class="stat-value" style="color: #f43f5e;">${stats.failedCount}</div>
            <div class="stat-meta"><span>Gateway simulator declines</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #94a3b8;">
            <div class="stat-label">CANCELLED / ABANDONED</div>
            <div class="stat-value" style="color: #94a3b8;">${stats.cancelledCount}</div>
            <div class="stat-meta"><span>User abandoned checkouts</span></div>
          </div>
          <div class="stat-card" style="border-top: 3px solid #38bdf8;">
            <div class="stat-label">TOTAL AUDIT LOGS</div>
            <div class="stat-value" style="color: #38bdf8;">${stats.totalTransactions}</div>
            <div class="stat-meta"><span>Idempotency-protected</span></div>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="glass-card" style="padding: 18px 22px; margin-bottom: 20px;">
          <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
            <div style="flex: 1; min-width: 220px;">
              <input type="text" class="form-input" id="admin-tx-search" placeholder="Search by student, register number, or ref..." 
                     oninput="AdvancedModules.filterAdminTransactions()">
            </div>
            <div>
              <select class="form-input" id="admin-tx-status" onchange="AdvancedModules.filterAdminTransactions()" style="width: auto;">
                <option value="all">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Transactions Table -->
        <div class="glass-card" style="padding: 0; overflow: hidden;">
          <div class="table-container">
            <table class="data-table" id="admin-tx-table">
              <thead>
                <tr>
                  <th>Transaction Ref</th>
                  <th>Student</th>
                  <th>Department</th>
                  <th>Category</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reconciliation</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody id="admin-tx-tbody">
                ${data.map(t => `
                  <tr>
                    <td><code>${escapeHtml(t.transactionRef)}</code></td>
                    <td>
                      <strong>${escapeHtml(t.studentName)}</strong>
                      <div style="font-size: 0.74rem; color: var(--text-dim);">${escapeHtml(t.registerNumber)}</div>
                    </td>
                    <td>${escapeHtml(t.departmentName || 'N/A')}</td>
                    <td>${escapeHtml(t.feeCategory)}</td>
                    <td>${escapeHtml(t.paymentMethod)}</td>
                    <td><strong>${formatINR(t.amount)}</strong></td>
                    <td>
                      <span class="badge ${t.status === 'Success' ? 'badge-success' : (t.status === 'Cancelled' ? 'badge-secondary' : 'badge-danger')}">
                        ${escapeHtml(t.status)}
                      </span>
                    </td>
                    <td>
                      ${t.reconciliation.reconciled 
                        ? '<span class="delta-pill positive">Reconciled</span>' 
                        : '<span class="delta-pill negative">Unreconciled</span>'}
                    </td>
                    <td style="font-size: 0.78rem; color: var(--text-dim);">
                      ${new Date(t.paymentDate).toLocaleString()}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      window._adminTxData = data;

    } catch (err) {
      console.error('[Admin Transactions Error]', err);
      containerEl.innerHTML = `
        <div class="glass-card" style="padding: 30px; text-align: center; border-left: 4px solid var(--accent-rose);">
          <div style="font-size: 1.5rem; margin-bottom: 8px;">⚠️</div>
          <div style="font-weight: 700; color: #fff;">Transaction Audit Unavailable</div>
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(err.message)}</div>
        </div>
      `;
    }
  }

  function filterAdminTransactions() {
    const search = document.getElementById('admin-tx-search')?.value?.toLowerCase() || '';
    const status = document.getElementById('admin-tx-status')?.value || 'all';
    const tbody = document.getElementById('admin-tx-tbody');
    if (!tbody || !window._adminTxData) return;

    const filtered = window._adminTxData.filter(t => {
      const matchSearch = !search || 
        t.studentName?.toLowerCase().includes(search) || 
        t.registerNumber?.toLowerCase().includes(search) || 
        t.transactionRef?.toLowerCase().includes(search);
      const matchStatus = status === 'all' || t.status === status;
      return matchSearch && matchStatus;
    });

    tbody.innerHTML = filtered.length === 0 ? `
      <tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No matching transactions found.</td></tr>
    ` : filtered.map(t => `
      <tr>
        <td><code>${escapeHtml(t.transactionRef)}</code></td>
        <td>
          <strong>${escapeHtml(t.studentName)}</strong>
          <div style="font-size: 0.74rem; color: var(--text-dim);">${escapeHtml(t.registerNumber)}</div>
        </td>
        <td>${escapeHtml(t.departmentName || 'N/A')}</td>
        <td>${escapeHtml(t.feeCategory)}</td>
        <td>${escapeHtml(t.paymentMethod)}</td>
        <td><strong>${formatINR(t.amount)}</strong></td>
        <td>
          <span class="badge ${t.status === 'Success' ? 'badge-success' : (t.status === 'Cancelled' ? 'badge-secondary' : 'badge-danger')}">
            ${escapeHtml(t.status)}
          </span>
        </td>
        <td>
          ${t.reconciliation.reconciled 
            ? '<span class="delta-pill positive">Reconciled</span>' 
            : '<span class="delta-pill negative">Unreconciled</span>'}
        </td>
        <td style="font-size: 0.78rem; color: var(--text-dim);">
          ${new Date(t.paymentDate).toLocaleString()}
        </td>
      </tr>
    `).join('');
  }

  // Public API
  return {
    initKnowledgeGraph,
    toggleKGView,
    resetKGZoom,
    filterKGNodes,
    selectKGNode,
    closeKGPanel,
    addKGToStudyPlan,

    initTrajectoryPredictor,

    initStudyPlanner,
    updateTaskStatus,
    deleteStudyTask,
    openAddStudyTaskModal,
    submitNewStudyTask,

    initSkillEvidence,
    addGapToStudyPlan,

    initDepartmentMiniDashboards,
    openDepartmentStudentDrilldown,

    initDemoPaymentWorkflow,
    openSimulatedCheckout,
    executeDemoPayment,
    viewTransactionReceipt,
    viewFeeInvoice,

    initDemoPaymentAuditTable,
    filterAdminTransactions
  };

})();

// Export globally
window.AdvancedModules = AdvancedModules;
