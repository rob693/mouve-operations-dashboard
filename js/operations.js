// MOUVE Operations Dashboard — v1.0

(function () {
  'use strict';

  var DATA_URL = 'operations-data.json';
  var STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  var PASSWORD_HASH = '4edbab53bcfeaa0a1d742c51e5e578e82ffaac49deb6490ec15ef53d3b039d44';
  var AUTH_KEY = 'mouve_ops_auth';

  // --- Auth ---

  function sha256(message) {
    var encoder = new TextEncoder();
    var data = encoder.encode(message);
    return crypto.subtle.digest('SHA-256', data).then(function (buffer) {
      var arr = Array.from(new Uint8Array(buffer));
      return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  function showDashboard() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    loadDashboard();
  }

  function setupAuth() {
    if (isAuthenticated()) {
      showDashboard();
      return;
    }

    var form = document.getElementById('login-form');
    var input = document.getElementById('login-password');
    var errorEl = document.getElementById('login-error');
    var btn = document.getElementById('login-btn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = input.value;
      if (!pw) return;

      btn.textContent = 'Checking...';
      btn.disabled = true;
      errorEl.style.display = 'none';

      sha256(pw).then(function (hash) {
        if (hash === PASSWORD_HASH) {
          sessionStorage.setItem(AUTH_KEY, 'true');
          showDashboard();
        } else {
          errorEl.style.display = 'block';
          input.value = '';
          input.focus();
          btn.textContent = 'Sign In';
          btn.disabled = false;
        }
      });
    });
  }

  // --- Dashboard ---

  function formatUKDate(isoString) {
    var d = new Date(isoString);
    var day = d.getDate();
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var month = months[d.getMonth()];
    var year = d.getFullYear();
    var hours = String(d.getHours()).padStart(2, '0');
    var mins = String(d.getMinutes()).padStart(2, '0');
    return day + ' ' + month + ' ' + year + ' at ' + hours + ':' + mins;
  }

  function formatUKDateShort(dateStr) {
    if (!dateStr) return '\u2014';
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var day = d.getDate();
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return day + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function populateCards(metrics) {
    document.getElementById('leads-won-7d').textContent = metrics.leads_won_7d;
    document.getElementById('leads-won-30d').textContent = metrics.leads_won_30d;
    document.getElementById('new-students-month').textContent = metrics.new_students_month;
    document.getElementById('active-students').textContent = metrics.active_students;
    document.getElementById('enrollments').textContent = metrics.enrollments;
    document.getElementById('classes-running').textContent = metrics.classes_running;

    // Term-on-term delta
    var prev = metrics.active_students_prev;
    if (prev) {
      var diff = metrics.active_students - prev;
      var pct = Math.round((diff / prev) * 100);
      var sign = diff >= 0 ? '+' : '';
      var deltaEl = document.getElementById('active-students-delta');
      deltaEl.textContent = sign + diff + ' vs ' + metrics.prev_term + ' (' + sign + pct + '%)';
      deltaEl.className = 'kpi-delta ' + (diff >= 0 ? 'positive' : 'negative');
    }
  }

  function updateTimestamps(data) {
    var generatedAt = data.generated_at;
    document.getElementById('last-updated').textContent =
      'Updated: ' + formatUKDate(generatedAt);

    var dspSync = data.meta && data.meta.dsp_last_sync;
    document.getElementById('dsp-sync').textContent =
      'DSP sync: ' + formatUKDateShort(dspSync);

    var term = data.meta && data.meta.term;
    if (term) {
      document.getElementById('term-badge').textContent = term;
    }
  }

  function checkStaleData(generatedAt) {
    var generated = new Date(generatedAt).getTime();
    var now = Date.now();
    var age = now - generated;

    if (age > STALE_THRESHOLD_MS) {
      var banner = document.getElementById('stale-banner');
      banner.style.display = 'block';
      document.getElementById('stale-time').textContent = formatUKDate(generatedAt);
    }
  }

  function renderBreakdown(metrics, meta) {
    var diff = metrics.active_students - (metrics.active_students_prev || 0);
    var rows = [
      { metric: 'Leads Won (7 days)', value: metrics.leads_won_7d, source: 'GHL Pipeline 1' },
      { metric: 'Leads Won (30 days)', value: metrics.leads_won_30d, source: 'GHL Pipeline 1' },
      { metric: 'New Students (Month)', value: metrics.new_students_month, source: 'DSP Export (manual)' },
      { metric: 'Active Students', value: metrics.active_students, source: 'Airtable ENROLLMENTS (unique students, ' + (metrics.prev_term || '') + ': ' + (metrics.active_students_prev || '—') + ', ' + (diff >= 0 ? '+' : '') + diff + ')' },
      { metric: 'Enrollments', value: metrics.enrollments, source: 'DSP via Airtable (synced ' + formatUKDateShort(meta.dsp_last_sync) + ')' },
      { metric: 'Classes Running', value: metrics.classes_running, source: 'DSP via Airtable' }
    ];

    var tbody = document.getElementById('breakdown-body');
    tbody.innerHTML = '';

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var tr = document.createElement('tr');
      var tdMetric = document.createElement('td');
      tdMetric.textContent = row.metric;
      var tdValue = document.createElement('td');
      tdValue.textContent = row.value;
      tdValue.className = 'value-cell';
      var tdSource = document.createElement('td');
      tdSource.textContent = row.source;
      tr.appendChild(tdMetric);
      tr.appendChild(tdValue);
      tr.appendChild(tdSource);
      tbody.appendChild(tr);
    }
  }

  function renderChart(metrics) {
    var ctx = document.getElementById('metrics-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [
          'Leads (7d)',
          'Leads (30d)',
          'New Students',
          'Active Students',
          'Enrollments',
          'Classes'
        ],
        datasets: [{
          label: 'Current Count',
          data: [
            metrics.leads_won_7d,
            metrics.leads_won_30d,
            metrics.new_students_month,
            metrics.active_students,
            metrics.enrollments,
            metrics.classes_running
          ],
          backgroundColor: [
            '#3b82f6',
            '#60a5fa',
            '#f59e0b',
            '#8b5cf6',
            '#a78bfa',
            '#7c3aed'
          ],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f0f0f0' },
            ticks: {
              callback: function (value) {
                return value.toLocaleString();
              }
            }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  function loadDashboard() {
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load data (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        populateCards(data.metrics);
        updateTimestamps(data);
        checkStaleData(data.generated_at);
        renderBreakdown(data.metrics, data.meta);
        renderChart(data.metrics);
      })
      .catch(function (err) {
        console.error('Dashboard error:', err);
        document.getElementById('leads-won-7d').textContent = 'Error';
      });
  }

  // --- Init ---

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAuth);
  } else {
    setupAuth();
  }
})();
