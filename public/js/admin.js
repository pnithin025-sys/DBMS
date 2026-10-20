// =====================================================================
// PIXORA ADMIN & SAFETY DASHBOARD CONTROLLER
// =====================================================================

const Admin = {
    async renderAdmin(container) {
        if (!Auth.currentUser || Auth.currentUser.role !== 'admin') {
            container.innerHTML = `
                <div style="text-align:center; padding:80px 20px;">
                    <div style="font-size:48px; margin-bottom:12px;">🛡️</div>
                    <h2>Access Denied</h2>
                    <p style="color:var(--text-muted); margin-top:8px;">You need System Administrator privileges to view this page.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="max-width: 1000px; margin: 0 auto; width: 100%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <div>
                        <h2 style="font-size:24px; font-weight:800;">Pixora Moderation & Platform Analytics</h2>
                        <p style="color:var(--text-secondary); font-size:13px; margin-top:2px;">DBMS Capstone Quality Assurance & Moderation Console</p>
                    </div>
                    <span style="background:var(--brand-primary); color:#FFF; font-size:11px; font-weight:800; padding:4px 10px; border-radius:var(--radius-full);">ADMIN MODE</span>
                </div>

                <!-- Metrics Grid -->
                <div id="admin-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:28px;">
                    <div class="skeleton" style="height:80px;"></div>
                    <div class="skeleton" style="height:80px;"></div>
                    <div class="skeleton" style="height:80px;"></div>
                    <div class="skeleton" style="height:80px;"></div>
                </div>

                <!-- Daily Activity Chart (CSS-based) -->
                <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:20px; margin-bottom:28px;">
                    <h3 style="font-size:15px; font-weight:700; margin-bottom:16px;">Daily Activity Volume (Last 7 Days)</h3>
                    <div id="admin-chart-bars" style="display:flex; align-items:flex-end; gap:16px; height:120px; padding-top:20px; border-bottom:1px solid var(--border-subtle);">
                    </div>
                </div>

                <!-- Pending Reports Section -->
                <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:20px; margin-bottom:28px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="font-size:16px; font-weight:700;">Safety Reports & Moderation Queue</h3>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-outline" style="font-size:12px; padding:4px 10px;" onclick="Admin.loadReports('pending')">Pending</button>
                            <button class="btn btn-outline" style="font-size:12px; padding:4px 10px;" onclick="Admin.loadReports('all')">All</button>
                        </div>
                    </div>
                    <div id="admin-reports-table">
                        <div class="spinner" style="margin:20px auto;"></div>
                    </div>
                </div>

                <!-- Live Trigger Audit Logs -->
                <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:20px;">
                    <h3 style="font-size:16px; font-weight:700; margin-bottom:14px;">Database Trigger Security & Audit Trail</h3>
                    <div id="admin-audit-logs" style="font-family:var(--font-mono); font-size:12px; max-height:260px; overflow-y:auto; line-height:1.6; background:var(--bg-surface-elevated); padding:14px; border-radius:var(--radius-md);">
                        Loading trigger audit logs...
                    </div>
                </div>
            </div>
        `;

        this.loadMetrics();
        this.loadReports('pending');
        this.loadAuditLogs();
    },

    async loadMetrics() {
        const grid = document.getElementById('admin-metrics-grid');
        const chart = document.getElementById('admin-chart-bars');
        if (!grid) return;

        try {
            const data = await API.get('/admin/metrics');
            if (data.success && data.metrics) {
                const m = data.metrics;
                grid.innerHTML = `
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800; color:var(--brand-primary);">${m.total_users || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Total Users</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800; color:var(--success);">${m.active_users || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Active Users</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800;">${m.total_posts || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Posts</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800; color:var(--brand-secondary);">${m.total_reels || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Reels</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800;">${m.total_comments || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Comments</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800; color:#EC4899;">${m.total_likes || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Total Likes</div>
                    </div>
                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px; text-align:center;">
                        <div style="font-size:22px; font-weight:800; color:var(--danger);">${m.pending_reports || 0}</div>
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Reports</div>
                    </div>
                `;

                // Render Chart Bars
                if (chart && data.daily_activity) {
                    chart.innerHTML = data.daily_activity.map(d => `
                        <div style="display:flex; flex-direction:column; align-items:center; flex:1;">
                            <div style="width:100%; max-width:32px; height:${Math.min(d.posts_count * 12, 100)}px; background:var(--brand-gradient); border-radius:4px 4px 0 0;" title="${d.posts_count} posts"></div>
                            <span style="font-size:10px; color:var(--text-muted); margin-top:6px;">${d.date.slice(5)}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            console.error('Failed loading metrics:', e);
        }
    },

    async loadReports(status = 'pending') {
        const container = document.getElementById('admin-reports-table');
        if (!container) return;

        try {
            const data = await API.get(`/admin/reports?status=${status}`);
            if (data.success && data.reports) {
                if (data.reports.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">No reports found in this queue.</div>';
                    return;
                }

                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${data.reports.map(r => `
                            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg-surface-elevated); border-radius:var(--radius-md); font-size:13px;">
                                <div>
                                    <span style="background:var(--danger); color:#FFF; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; text-transform:uppercase;">${r.reason}</span>
                                    <strong style="margin-left:8px;">Target: ${r.target_type} #${r.target_id}</strong>
                                    <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
                                        Reported by @${r.reporter_username}: "${r.description || 'No description'}"
                                    </div>
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn btn-danger" style="font-size:11px; padding:4px 10px;" onclick="Admin.removeReportedContent('${r.target_type}', ${r.target_id}, ${r.report_id})">Remove Content</button>
                                    <button class="btn btn-outline" style="font-size:11px; padding:4px 10px;" onclick="Admin.updateReport(${r.report_id}, 'dismissed')">Dismiss</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        } catch (e) {
            container.innerHTML = '<div style="color:var(--danger); padding:10px;">Failed to load reports.</div>';
        }
    },

    async removeReportedContent(type, id, reportId) {
        if (!confirm(`Are you sure you want to permanently delete this ${type}?`)) return;
        try {
            await API.post('/admin/remove-content', { target_type: type, target_id: id, report_id: reportId });
            if (window.showToast) window.showToast('Content removed and action logged.', 'success');
            this.loadReports('pending');
            this.loadMetrics();
            this.loadAuditLogs();
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    async updateReport(reportId, status) {
        try {
            await API.put(`/admin/reports/${reportId}`, { status });
            if (window.showToast) window.showToast('Report updated.', 'info');
            this.loadReports('pending');
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
        }
    },

    async loadAuditLogs() {
        const container = document.getElementById('admin-audit-logs');
        if (!container) return;

        try {
            const data = await API.get('/admin/audit-logs');
            if (data.success && data.logs) {
                if (data.logs.length === 0) {
                    container.innerHTML = 'No audit log entries recorded yet.';
                    return;
                }

                container.innerHTML = data.logs.map(log => `
                    <div style="margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">
                        <span style="color:var(--brand-primary); font-weight:700;">[${log.logged_at}]</span> 
                        <span style="color:var(--warning);">${log.action_type}</span> on 
                        <strong>${log.table_name}</strong> (ID: ${log.record_id}) 
                        by user #${log.performed_by || 'system'}
                        ${log.details ? `<br><span style="color:var(--text-muted); margin-left:14px;">details: ${JSON.stringify(log.details)}</span>` : ''}
                    </div>
                `).join('');
            }
        } catch (e) {
            container.innerHTML = 'Audit log unavailable.';
        }
    }
};

window.Admin = Admin;
