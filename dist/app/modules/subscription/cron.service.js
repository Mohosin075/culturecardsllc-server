"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const monitoring_service_1 = require("./monitoring.service");
class CronService {
    constructor() {
        this.jobs = new Map();
        this.jobStatus = new Map();
    }
    // Start all subscription-related cron jobs
    startSubscriptionCronJobs() {
        if (process.env.NODE_ENV === 'production' ||
            process.env.ENABLE_SUBSCRIPTION_MONITORING === 'true') {
            this.startHealthMonitoring();
            this.startDailyReporting();
            this.startWebhookHealthCheck();
            this.startTrialConversionMonitoring();
            console.log('Subscription cron jobs started');
        }
        else {
            console.log('Subscription monitoring disabled in development mode');
        }
    }
    // Monitor subscription health every hour
    startHealthMonitoring() {
        const job = node_cron_1.default.schedule('0 * * * *', async () => {
            try {
                console.log('Running subscription health monitoring...');
                await monitoring_service_1.monitoringService.runAllMonitoringTasks();
            }
            catch (error) {
                console.error('Error in subscription health monitoring cron:', error);
            }
        }, {
            timezone: 'UTC',
        });
        job.start();
        this.jobs.set('health-monitoring', job);
        this.jobStatus.set('health-monitoring', true);
        console.log('Health monitoring cron job scheduled (every hour)');
    }
    // Generate daily reports at 9 AM UTC
    startDailyReporting() {
        const reportTime = process.env.DAILY_REPORT_TIME || '09:00';
        const [hour, minute] = reportTime.split(':');
        const job = node_cron_1.default.schedule(`${minute} ${hour} * * *`, async () => {
            try {
                console.log('Generating daily subscription report...');
                const report = await monitoring_service_1.monitoringService.generateDailyReport();
                // You could send this report via email or Slack
                console.log('Daily subscription report generated successfully');
            }
            catch (error) {
                console.error('Error generating daily subscription report:', error);
            }
        }, {
            timezone: 'UTC',
        });
        job.start();
        this.jobs.set('daily-reporting', job);
        this.jobStatus.set('daily-reporting', true);
        console.log(`Daily reporting cron job scheduled (${reportTime} UTC)`);
    }
    // Check webhook health every 6 hours
    startWebhookHealthCheck() {
        const job = node_cron_1.default.schedule('0 */6 * * *', async () => {
            try {
                console.log('Running webhook health check...');
                await monitoring_service_1.monitoringService.monitorWebhookHealth();
            }
            catch (error) {
                console.error('Error in webhook health check cron:', error);
            }
        }, {
            timezone: 'UTC',
        });
        job.start();
        this.jobs.set('webhook-health', job);
        this.jobStatus.set('webhook-health', true);
        console.log('Webhook health check cron job scheduled (every 6 hours)');
    }
    // Monitor trial conversions every 4 hours
    startTrialConversionMonitoring() {
        const job = node_cron_1.default.schedule('0 */4 * * *', async () => {
            try {
                console.log('Running trial conversion monitoring...');
                await monitoring_service_1.monitoringService.monitorTrialConversions();
            }
            catch (error) {
                console.error('Error in trial conversion monitoring cron:', error);
            }
        }, {
            timezone: 'UTC',
        });
        job.start();
        this.jobs.set('trial-conversion', job);
        this.jobStatus.set('trial-conversion', true);
        console.log('Trial conversion monitoring cron job scheduled (every 4 hours)');
    }
    // Stop all cron jobs
    stopAllJobs() {
        this.jobs.forEach((job, name) => {
            job.stop();
            this.jobStatus.set(name, false);
            console.log(`Stopped cron job: ${name}`);
        });
        this.jobs.clear();
        this.jobStatus.clear();
        console.log('All subscription cron jobs stopped');
    }
    // Get status of all jobs
    getJobsStatus() {
        const status = {};
        this.jobStatus.forEach((isRunning, name) => {
            status[name] = isRunning;
        });
        return status;
    }
    // Stop a specific job
    stopJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.stop();
            this.jobStatus.set(jobName, false);
            console.log(`Stopped cron job: ${jobName}`);
            return true;
        }
        return false;
    }
    // Start a specific job (if it was stopped)
    startJob(jobName) {
        const job = this.jobs.get(jobName);
        if (job) {
            job.start();
            this.jobStatus.set(jobName, true);
            console.log(`Started cron job: ${jobName}`);
            return true;
        }
        return false;
    }
}
exports.cronService = new CronService();
