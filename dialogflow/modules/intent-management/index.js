const IntentManager = require('./IntentManager');
const IntentImporter = require('./IntentImporter');
const IntentExporter = require('./IntentExporter');

class IntentManagementModule {
  constructor(config) {
    this.config = config;
    this.intentManager = new IntentManager(config);
    this.importer = new IntentImporter(this.intentManager);
    this.exporter = new IntentExporter(this.intentManager);
  }

  // Intent Manager methods
  async createIntent(intentData) {
    return this.intentManager.createIntent(intentData);
  }

  async listIntents() {
    return this.intentManager.listIntents();
  }

  async updateIntent(intentName, updates) {
    return this.intentManager.updateIntent(intentName, updates);
  }

  async deleteIntent(intentName) {
    return this.intentManager.deleteIntent(intentName);
  }

  async getIntent(intentName) {
    return this.intentManager.getIntent(intentName);
  }

  async batchImportIntents(intentsData) {
    return this.intentManager.batchImportIntents(intentsData);
  }

  async exportIntents() {
    return this.intentManager.exportIntents();
  }

  validateIntentData(intentData) {
    return this.intentManager.validateIntentData(intentData);
  }

  async searchIntents(searchText) {
    return this.intentManager.searchIntents(searchText);
  }

  async getIntentStatistics() {
    return this.intentManager.getIntentStatistics();
  }

  async testIntent(phrase, sessionId) {
    return this.intentManager.testIntent(phrase, sessionId);
  }

  // Importer methods
  async importFromCSV(filePath) {
    return this.importer.importFromCSV(filePath);
  }

  async importFromJSON(filePath) {
    return this.importer.importFromJSON(filePath);
  }

  async importFromDialogflowBackup(backupPath) {
    return this.importer.importFromDialogflowBackup(backupPath);
  }

  validateImportFile(filePath, format) {
    return this.importer.validateImportFile(filePath, format);
  }

  generateCSVTemplate(outputPath) {
    return this.importer.generateCSVTemplate(outputPath);
  }

  async previewImport(filePath, format) {
    return this.importer.previewImport(filePath, format);
  }

  // Exporter methods
  async exportToCSV(outputPath, options) {
    return this.exporter.exportToCSV(outputPath, options);
  }

  async exportToJSON(outputPath, options) {
    return this.exporter.exportToJSON(outputPath, options);
  }

  async exportToDialogflowFormat(outputPath, options) {
    return this.exporter.exportToDialogflowFormat(outputPath, options);
  }

  async exportReport(outputPath, options) {
    return this.exporter.exportReport(outputPath, options);
  }

  async exportFullBackup(outputPath) {
    return this.exporter.exportFullBackup(outputPath);
  }

  // Utility methods
  getManager() {
    return this.intentManager;
  }

  getImporter() {
    return this.importer;
  }

  getExporter() {
    return this.exporter;
  }
}

module.exports = {
  IntentManagementModule,
  IntentManager,
  IntentImporter,
  IntentExporter
};