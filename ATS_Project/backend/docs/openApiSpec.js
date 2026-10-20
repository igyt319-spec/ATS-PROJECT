/**
 * ATS OpenAPI 3.0 Specification
 * =============================
 * Complete, authoritative API schema documentation for the ATS Intelligence Platform.
 */

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ATS Intelligence Platform API',
    version: '2.5.0',
    description: `
**AI-Powered Academic Progress, Prediction and Career Readiness Platform (ATS)**
Provides REST endpoints for student academic progress tracking, attendance compliance,
digital twins, predictive forecasting, career readiness roadmaps, verified achievement passports,
what-if academic simulations, and immutable audit logs.
    `,
    contact: {
      name: 'ATS Academic Engineering Team',
      email: 'engineering@ats.edu'
    }
  },
  servers: [
    { url: '/api', description: 'Current Origin API Base' },
    { url: 'http://localhost:5000/api', description: 'Local Development Server' }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supply your Bearer JWT token received from /api/auth/login.'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Descriptive error explanation.' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['identifier', 'password', 'role'],
        properties: {
          identifier: { type: 'string', example: 'BITD0001 or student@ats.edu' },
          password: { type: 'string', format: 'password', example: 'Student@123' },
          role: { type: 'string', enum: ['student', 'faculty', 'admin'], example: 'student' }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'Kavitha M' },
              email: { type: 'string', example: 'kavitha.demo@ats.edu' },
              role: { type: 'string', example: 'student' },
              studentId: { type: 'integer', example: 1 }
            }
          }
        }
      },
      DigitalTwinResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          digitalTwin: {
            type: 'object',
            properties: {
              student: { type: 'object' },
              historicalTrends: { type: 'array', items: { type: 'object' } },
              prediction: {
                type: 'object',
                properties: {
                  isAvailable: { type: 'boolean', example: true },
                  targetSemester: { type: 'integer', example: 2 },
                  predictedGpa: { type: 'number', example: 8.65 },
                  gpaRange: { type: 'object', properties: { low: { type: 'number', example: 8.35 }, high: { type: 'number', example: 8.95 } } },
                  confidenceScore: { type: 'number', example: 85.0 },
                  methodUsed: { type: 'string', example: 'Weighted Linear Trend Regression' },
                  disclaimer: { type: 'string' }
                }
              },
              evaluationMetrics: {
                type: 'object',
                properties: {
                  evaluatedSamples: { type: 'integer', example: 2 },
                  mae: { type: 'number', example: 0.18 },
                  rmse: { type: 'number', example: 0.22 }
                }
              }
            }
          }
        }
      },
      CareerReadinessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          role: { type: 'object' },
          readinessIndex: { type: 'number', example: 78.5 },
          competenciesCount: { type: 'integer', example: 5 },
          demonstratedCount: { type: 'integer', example: 3 },
          missingCount: { type: 'integer', example: 2 },
          evaluatedCompetencies: { type: 'array', items: { type: 'object' } },
          roadmap: { type: 'object' }
        }
      },
      PublicPassportVerifyResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          verified: { type: 'boolean', example: true },
          verificationNotice: { type: 'string', example: 'OFFICIAL ATS INTEGRITY RECORD — VERIFIED BY INSTITUTIONAL MENTOR' },
          data: {
            type: 'object',
            properties: {
              achievementTitle: { type: 'string', example: 'Smart India Hackathon 2026 Winner' },
              category: { type: 'string', example: 'Hackathon' },
              recipientDisplayName: { type: 'string', example: 'Kavitha M.' },
              academicDepartment: { type: 'string', example: 'Electronics & Communication Engineering' },
              eventDate: { type: 'string', format: 'date', example: '2026-03-15' },
              verifyingAuthority: { type: 'string', example: 'Faculty Mentor & Academic Advisory Board' },
              verificationCode: { type: 'string', example: '7f9a2b4e8c1d6f30a9e7' }
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Service Health & Infrastructure Probe',
        tags: ['System'],
        responses: {
          200: { description: 'Service is operational with database connectivity status.' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate User and Receive Bearer JWT',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
        },
        responses: {
          200: { description: 'Authenticated successfully.', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          401: { description: 'Invalid credentials or inactive account.' }
        }
      }
    },
    '/digital-twin/{studentId}': {
      get: {
        summary: 'Feature 1: Retrieve AI Academic Digital Twin Profile',
        tags: ['Feature 1: Digital Twin'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'path', required: true, schema: { type: 'integer' }, description: 'Target Student ID' }
        ],
        responses: {
          200: { description: 'Digital Twin profile with linear regression forecast and MAE/RMSE metrics.', content: { 'application/json': { schema: { $ref: '#/components/schemas/DigitalTwinResponse' } } } },
          403: { description: 'Forbidden. Students can only view their own profile; mentors query assigned mentees.' }
        }
      }
    },
    '/career/roles': {
      get: {
        summary: 'Feature 2: List Configured Career Roles (VLSI, Embedded, ECE, SWE, AI/ML)',
        tags: ['Feature 2: Career Readiness'],
        responses: {
          200: { description: 'List of active career tracks and required competencies.' }
        }
      }
    },
    '/career/evaluation/{studentId}': {
      get: {
        summary: 'Feature 2: Evaluate Student Career Readiness & Skills Gap',
        tags: ['Feature 2: Career Readiness'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'role_id', in: 'query', schema: { type: 'integer' }, description: 'Optional specific career role ID' }
        ],
        responses: {
          200: { description: 'Competency evaluation, skills gap analysis, and personalized roadmap.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CareerReadinessResponse' } } } }
        }
      }
    },
    '/career/assess/{studentId}': {
      get: {
        summary: 'Feature 2: Career Competency Matrix & Gap Assessment (Alias)',
        tags: ['Feature 2: Career Readiness'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'role_id', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Evaluated competencies and skill gaps.' }
        }
      }
    },
    '/career/target': {
      post: {
        summary: 'Feature 2: Set or Update Primary Target Career Track',
        tags: ['Feature 2: Career Readiness'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role_id'],
                properties: {
                  student_id: { type: 'integer' },
                  role_id: { type: 'integer', example: 4 },
                  target_proficiency: { type: 'string', example: 'Entry' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Target career role set successfully.' }
        }
      }
    },
    '/activities/passport/{studentId}': {
      get: {
        summary: 'Feature 3: Generate Placement-Ready Achievement Passport Portfolio',
        tags: ['Feature 3: Achievement Passport'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'studentId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Structured passport data with verification tokens and category summaries.' }
        }
      }
    },
    '/activities/passport/verify/{token}': {
      get: {
        summary: 'Feature 3: Public QR-Code Verification Endpoint (No Auth Required)',
        tags: ['Feature 3: Achievement Passport'],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' }, description: 'Cryptographic certificate verification token' }
        ],
        responses: {
          200: { description: 'Certificate verified. Displays public non-sensitive verification facts.', content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicPassportVerifyResponse' } } } },
          404: { description: 'Certificate token not found or revoked.' }
        }
      }
    },
    '/college-twin/department/{departmentId}': {
      get: {
        summary: 'Feature 4: Department Intelligence Digest (HOD Scoped)',
        tags: ['Feature 4: College Digital Twin'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'departmentId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: { description: 'Department performance trends, risk distribution, subject pass rates, and mentor workload.' },
          403: { description: 'Forbidden. HODs can only view their authorized department.' }
        }
      }
    },
    '/college-twin/institution': {
      get: {
        summary: 'Feature 4: Institutional Overview & Department Comparison',
        tags: ['Feature 4: College Digital Twin'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Macro-level institutional analytics comparing all departments.' },
          403: { description: 'Restricted to system administrators and institutional leadership.' }
        }
      }
    },
    '/chatbot/message': {
      post: {
        summary: 'Feature 5: Interact with AI Academic Mentor 2.0',
        tags: ['Feature 5: AI Academic Mentor'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'What are my weak subjects and how can I improve my GPA?' },
                  student_id: { type: 'integer', example: 1, description: 'Required for mentors querying a mentee' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Contextual, encouraging advisory grounded strictly in live academic records.' }
        }
      }
    },
    '/simulator/target-gpa': {
      post: {
        summary: 'Feature 6: Solve Required Exam Marks for Target GPA',
        tags: ['Feature 6: Academic Simulator'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['student_id', 'target_gpa'],
                properties: {
                  student_id: { type: 'integer', example: 1 },
                  target_gpa: { type: 'number', example: 8.5 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Non-destructive simulation calculating required examination marks per subject.' }
        }
      }
    },
    '/simulator/attendance': {
      post: {
        summary: 'Feature 6: Simulate Attendance Projections & Safe Bunk Buffers',
        tags: ['Feature 6: Academic Simulator'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['student_id', 'upcoming_classes_total', 'upcoming_classes_attended'],
                properties: {
                  student_id: { type: 'integer', example: 1 },
                  upcoming_classes_total: { type: 'integer', example: 20 },
                  upcoming_classes_attended: { type: 'integer', example: 18 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Projected attendance percentage and eligibility compliance.' }
        }
      }
    },
    '/audit-logs': {
      get: {
        summary: 'Feature 7: Query Filterable Academic Integrity Audit Trail',
        tags: ['Feature 7: Integrity & Audit'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
          { name: 'user_email', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }
        ],
        responses: {
          200: { description: 'Immutable log of sensitive operations.' },
          403: { description: 'Restricted to system administrators.' }
        }
      }
    },
    '/audit-logs/export': {
      get: {
        summary: 'Feature 7: Download Audit Trail Report (CSV or JSON)',
        tags: ['Feature 7: Integrity & Audit'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'json'], default: 'csv' } }
        ],
        responses: {
          200: { description: 'Audit report file download stream.' }
        }
      }
    },
    '/audit-logs/anomalies': {
      get: {
        summary: 'Feature 7: Scan Heuristic Audit Anomalies',
        tags: ['Feature 7: Integrity & Audit'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Rule-based anomaly detection results (rapid modifications, off-hours grade edits).' }
        }
      }
    }
  }
};

module.exports = openApiSpec;
