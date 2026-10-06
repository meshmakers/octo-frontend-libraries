export enum Roles {
  ReportingManagement = 'ReportingManagement',
  ReportingViewer = 'ReportingViewer',
  AdminPanelManagement = 'AdminPanelManagement',
  /**
   * Trigger secret sweeps (Verify / Encrypt / CleanupUnreadable) and delete a pre-sweep dump early
   * (SECRET value type AB#5528, handover §6). Seeded by `System.Identity.Bootstrap`
   * (`CommonConstants.SecretManagementRole`); the secrets overview itself needs `AdminPanelManagement`.
   */
  SecretManagement = 'SecretManagement',
  BotManagement = 'BotManagement',
  UserManagement = 'UserManagement',
  CommunicationManagement = 'CommunicationManagement',
  TenantManagement = 'TenantManagement',
  Development = 'Development',
  StreamDataAdmin = 'StreamDataAdmin',
  StreamDataWriter = 'StreamDataWriter',
  StreamDataReader = 'StreamDataReader'
}
