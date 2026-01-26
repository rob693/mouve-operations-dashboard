// MOUVE Operations Dashboard — v1.0

(function () {
  'use strict';

  var DATA_URL = 'operations-data.json';
  var STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Format a date for UK display
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

  // Populate KPI cards
  function populateCards(metrics) {
    document.getElementById('leads-won-7d').textContent = metrics.leads_won_7d;
    document.getElementById('leads-won-30d').textContent = metrics.leads_won_30d;
    document.getElementById('children-enrolled').textContent = metrics.children_enrolled;
    document.getElementById('classes-running').textContent = metrics.classes_running;
    document.getElementById('lf-members').textContent = metrics.lf_members;
    document.getElementById('lf-trials').textContent = metrics.lf_trials;
    document.getElementById('trial-conversion').textContent =
      Math.round(metrics.trial_conversion_rate * 100) + '%';
  }

  // Update timestamps
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

  // Check for stale data (>24 hours old)
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

  // Render breakdown table
  function renderBreakdown(metrics, meta) {
    var rows = [
      { metric: 'Leads Won (7 days)', value: metrics.leads_won_7d, source: 'GHL Pipeline 1' },
      { metric: 'Leads Won (30 days)', value: metrics.leads_won_30d, source: 'GHL Pipeline 1' },
      { metric: 'Children Enrolled', value: metrics.children_enrolled, source: 'DSP via Airtable (synced ' + formatUKDateShort(meta.dsp_last_sync) + ')' },
      { metric: 'Classes Running', value: metrics.classes_running, source: 'DSP via Airtable' },
      { metric: 'LF Active Members', value: metrics.lf_members, source: 'Airtable CONTACTS' },
      { metric: 'LF Active Trials', value: metrics.lf_trials, source: 'Airtable CONTACTS' },
      { metric: 'LF Trial Conversion', value: Math.round(metrics.trial_conversion_rate * 100) + '%', source: 'Calculated: members / (members + trials)' }
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

  // Render Chart.js bar chart — overview of current metrics
  function renderChart(metrics) {
    var ctx = document.getElementById('metrics-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [
          'Leads (7d)',
          'Leads (30d)',
          'Children',
          'Classes',
          'LF Members',
          'LF Trials'
        ],
        datasets: [{
          label: 'Current Count',
          data: [
            metrics.leads_won_7d,
            metrics.leads_won_30d,
            metrics.children_enrolled,
            metrics.classes_running,
            metrics.lf_members,
            metrics.lf_trials
          ],
          backgroundColor: [
            '#3b82f6',
            '#60a5fa',
            '#8b5cf6',
            '#a78bfa',
            '#10b981',
            '#34d399'
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

  // Fetch and render
  function init() {
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

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
