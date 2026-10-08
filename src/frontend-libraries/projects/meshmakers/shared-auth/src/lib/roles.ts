export enum Roles {
  ReportingManagement = 'ReportingManagement',
  ReportingViewer = 'ReportingViewer',
  /**
   * Manage platform files: create/delete roots and folders, upload, move, rename and delete files in the
   * tenant file system (`System/FileSystemItem`, AB#6171 decision D5). Seeded by `System.Identity.Bootstrap`
   * and granted to every holder of `ReportingManagement` by a one-off identity migration.
   */
  FileManagement = 'FileManagement',
  /**
   * Browse and download platform files (AB#6171 decision D5). Seeded by `System.Identity.Bootstrap`
   * and granted to every holder of `ReportingViewer` by a one-off identity migration.
   */
  FileViewer = 'FileViewer',
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
