/*
 * Fixtures captured from the live local tenant "meshmakers" (AB#5522, 2026-10-05) with the
 * documents in ../../graphQL: entityFormGetEntityForms (form-default, form-sftp-configuration),
 * entityFormGetCkType (System.Communication/SftpConfiguration, System.UI/EntityForm) and
 * entityFormGetCkRecord (System.UI-2.7.0/EntityFormSection-1). Do not edit by hand.
 */
import { RawRtEntityRow } from '../entity-form-parser';
import { RawCkRecord, RawCkType } from '../ck-metadata';

export const LIVE_FORM_DEFAULT_ROW: RawRtEntityRow = {
  'rtId': '670300000000000000000001',
  'rtWellKnownName': 'form-default',
  'ckTypeId': 'System.UI/EntityForm',
  'attributes': {
    'items': [
      {
        'attributeName': 'name',
        'value': 'Default form'
      },
      {
        'attributeName': 'description',
        'value': 'Fallback form for every entity type without a form of its own. Seeded by platform-services; create a tenant EntityForm for a type to override it.'
      },
      {
        'attributeName': 'targetCkTypeId',
        'value': 'System/Entity'
      },
      {
        'attributeName': 'includeDerivedTypes',
        'value': true
      },
      {
        'attributeName': 'category',
        'value': null
      },
      {
        'attributeName': 'icon',
        'value': null
      },
      {
        'attributeName': 'priority',
        'value': 0
      },
      {
        'attributeName': 'canCreate',
        'value': true
      },
      {
        'attributeName': 'canEdit',
        'value': true
      },
      {
        'attributeName': 'canDelete',
        'value': true
      },
      {
        'attributeName': 'canDuplicate',
        'value': false
      },
      {
        'attributeName': 'canExport',
        'value': true
      },
      {
        'attributeName': 'singleton',
        'value': null
      },
      {
        'attributeName': 'singletonWellKnownName',
        'value': null
      },
      {
        'attributeName': 'customComponent',
        'value': null
      },
      {
        'attributeName': 'generateRemainingFields',
        'value': true
      },
      {
        'attributeName': 'generatedSectionTitle',
        'value': 'Attributes'
      },
      {
        'attributeName': 'sections',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormSection',
            'attributes': [
              {
                'attributeName': 'key',
                'value': 'general'
              },
              {
                'attributeName': 'title',
                'value': 'General'
              },
              {
                'attributeName': 'description',
                'value': null
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'collapsed',
                'value': null
              },
              {
                'attributeName': 'columns',
                'value': 2
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormSection',
            'attributes': [
              {
                'attributeName': 'key',
                'value': 'system'
              },
              {
                'attributeName': 'title',
                'value': 'System'
              },
              {
                'attributeName': 'description',
                'value': 'Blueprint provenance stamped by the engine when a blueprint seeded this entity.'
              },
              {
                'attributeName': 'order',
                'value': 99
              },
              {
                'attributeName': 'collapsed',
                'value': true
              },
              {
                'attributeName': 'columns',
                'value': null
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'fields',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'rtWellKnownName'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'general'
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'label',
                'value': 'Well-known name'
              },
              {
                'attributeName': 'help',
                'value': 'Stable, tenant-unique handle other entities, pipelines and the Studio use to find this entity. Cannot be changed after creation.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': 'afterCreate'
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Name'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'general'
              },
              {
                'attributeName': 'order',
                'value': 1
              },
              {
                'attributeName': 'label',
                'value': null
              },
              {
                'attributeName': 'help',
                'value': null
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': 'half'
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Description'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'general'
              },
              {
                'attributeName': 'order',
                'value': 2
              },
              {
                'attributeName': 'label',
                'value': null
              },
              {
                'attributeName': 'help',
                'value': null
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': 'multiline'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'RtBlueprintSource'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'system'
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'label',
                'value': 'Blueprint source'
              },
              {
                'attributeName': 'help',
                'value': 'Blueprint that seeded this entity.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': 'always'
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'RtBlueprintLocked'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'system'
              },
              {
                'attributeName': 'order',
                'value': 1
              },
              {
                'attributeName': 'label',
                'value': 'Blueprint locked'
              },
              {
                'attributeName': 'help',
                'value': 'Whether the blueprint still manages this entity (a re-apply overwrites it); false keeps it as user data.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': 'always'
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'RtBlueprintAppliedAt'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'system'
              },
              {
                'attributeName': 'order',
                'value': 2
              },
              {
                'attributeName': 'label',
                'value': 'Blueprint applied at'
              },
              {
                'attributeName': 'help',
                'value': 'When the blueprint last wrote this entity.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': 'always'
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'listColumns',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'rtWellKnownName'
              },
              {
                'attributeName': 'label',
                'value': 'Name'
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Name'
              },
              {
                'attributeName': 'label',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'rtChangedDateTime'
              },
              {
                'attributeName': 'label',
                'value': 'Changed'
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': 'date'
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'rtBlueprintSource',
        'value': 'System.UI.EntityForms-1.0.0'
      },
      {
        'attributeName': 'rtBlueprintLocked',
        'value': true
      },
      {
        'attributeName': 'rtBlueprintAppliedAt',
        'value': '2026-10-05T20:48:47.14Z'
      }
    ]
  }
};

export const LIVE_FORM_SFTP_ROW: RawRtEntityRow = {
  'rtId': '670300000000000000000010',
  'rtWellKnownName': 'form-sftp-configuration',
  'ckTypeId': 'System.UI/EntityForm',
  'attributes': {
    'items': [
      {
        'attributeName': 'name',
        'value': 'SFTP configuration'
      },
      {
        'attributeName': 'description',
        'value': 'Connection to an SFTP server (password or private-key authentication).'
      },
      {
        'attributeName': 'targetCkTypeId',
        'value': 'System.Communication/SftpConfiguration'
      },
      {
        'attributeName': 'includeDerivedTypes',
        'value': false
      },
      {
        'attributeName': 'category',
        'value': 'connections'
      },
      {
        'attributeName': 'icon',
        'value': null
      },
      {
        'attributeName': 'priority',
        'value': null
      },
      {
        'attributeName': 'canCreate',
        'value': true
      },
      {
        'attributeName': 'canEdit',
        'value': true
      },
      {
        'attributeName': 'canDelete',
        'value': true
      },
      {
        'attributeName': 'canDuplicate',
        'value': null
      },
      {
        'attributeName': 'canExport',
        'value': null
      },
      {
        'attributeName': 'singleton',
        'value': null
      },
      {
        'attributeName': 'singletonWellKnownName',
        'value': null
      },
      {
        'attributeName': 'customComponent',
        'value': null
      },
      {
        'attributeName': 'generateRemainingFields',
        'value': null
      },
      {
        'attributeName': 'generatedSectionTitle',
        'value': null
      },
      {
        'attributeName': 'sections',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormSection',
            'attributes': [
              {
                'attributeName': 'key',
                'value': 'server'
              },
              {
                'attributeName': 'title',
                'value': 'Server'
              },
              {
                'attributeName': 'description',
                'value': null
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'collapsed',
                'value': null
              },
              {
                'attributeName': 'columns',
                'value': 2
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormSection',
            'attributes': [
              {
                'attributeName': 'key',
                'value': 'auth'
              },
              {
                'attributeName': 'title',
                'value': 'Authentication'
              },
              {
                'attributeName': 'description',
                'value': 'Password and/or private key; at least one is needed to log in.'
              },
              {
                'attributeName': 'order',
                'value': 1
              },
              {
                'attributeName': 'collapsed',
                'value': null
              },
              {
                'attributeName': 'columns',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormSection',
            'attributes': [
              {
                'attributeName': 'key',
                'value': 'limits'
              },
              {
                'attributeName': 'title',
                'value': 'Limits'
              },
              {
                'attributeName': 'description',
                'value': null
              },
              {
                'attributeName': 'order',
                'value': 2
              },
              {
                'attributeName': 'collapsed',
                'value': true
              },
              {
                'attributeName': 'columns',
                'value': null
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'fields',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'rtWellKnownName'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'server'
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'label',
                'value': 'Name'
              },
              {
                'attributeName': 'help',
                'value': 'Unique name of the configuration; pipelines reference it by this name. Cannot be changed after creation.'
              },
              {
                'attributeName': 'placeholder',
                'value': 'Enter configuration name'
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': 'afterCreate'
              },
              {
                'attributeName': 'required',
                'value': true
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Host'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'server'
              },
              {
                'attributeName': 'order',
                'value': 1
              },
              {
                'attributeName': 'label',
                'value': 'Host'
              },
              {
                'attributeName': 'help',
                'value': 'Host name or IP address of the SFTP server.'
              },
              {
                'attributeName': 'placeholder',
                'value': 'sftp.example.com'
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': true
              },
              {
                'attributeName': 'width',
                'value': 'half'
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Port'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'server'
              },
              {
                'attributeName': 'order',
                'value': 2
              },
              {
                'attributeName': 'label',
                'value': 'Port'
              },
              {
                'attributeName': 'help',
                'value': 'TCP port of the SFTP server (default 22).'
              },
              {
                'attributeName': 'placeholder',
                'value': '22'
              },
              {
                'attributeName': 'editor',
                'value': 'number'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': true
              },
              {
                'attributeName': 'width',
                'value': 'half'
              },
              {
                'attributeName': 'default',
                'value': '22'
              },
              {
                'attributeName': 'min',
                'value': 1
              },
              {
                'attributeName': 'max',
                'value': 65535
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Username'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'auth'
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'label',
                'value': 'Username'
              },
              {
                'attributeName': 'help',
                'value': null
              },
              {
                'attributeName': 'placeholder',
                'value': 'Enter username'
              },
              {
                'attributeName': 'editor',
                'value': null
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': true
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Password'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'auth'
              },
              {
                'attributeName': 'order',
                'value': 1
              },
              {
                'attributeName': 'label',
                'value': 'Password'
              },
              {
                'attributeName': 'help',
                'value': 'Password for password authentication (optional when a private key is used).'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': 'password'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': true
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'PrivateKey'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'auth'
              },
              {
                'attributeName': 'order',
                'value': 2
              },
              {
                'attributeName': 'label',
                'value': 'Private key'
              },
              {
                'attributeName': 'help',
                'value': 'Private key (PEM / OpenSSH format) for key-based authentication (optional).'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': 'multiline'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': true
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'PrivateKeyPassphrase'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'auth'
              },
              {
                'attributeName': 'order',
                'value': 3
              },
              {
                'attributeName': 'label',
                'value': 'Private key passphrase'
              },
              {
                'attributeName': 'help',
                'value': 'Passphrase protecting the private key, if any.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': 'password'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': null
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': true
              },
              {
                'attributeName': 'visibleWhen',
                'value': 'PrivateKey=*'
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormField',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'MaxConcurrentConnections'
              },
              {
                'attributeName': 'sectionKey',
                'value': 'limits'
              },
              {
                'attributeName': 'order',
                'value': 0
              },
              {
                'attributeName': 'label',
                'value': 'Max concurrent connections'
              },
              {
                'attributeName': 'help',
                'value': 'Maximum number of connections opened to the server at the same time. Empty = adapter default.'
              },
              {
                'attributeName': 'placeholder',
                'value': null
              },
              {
                'attributeName': 'editor',
                'value': 'number'
              },
              {
                'attributeName': 'readOnly',
                'value': null
              },
              {
                'attributeName': 'required',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'default',
                'value': null
              },
              {
                'attributeName': 'min',
                'value': 1
              },
              {
                'attributeName': 'max',
                'value': null
              },
              {
                'attributeName': 'pattern',
                'value': null
              },
              {
                'attributeName': 'secret',
                'value': null
              },
              {
                'attributeName': 'visibleWhen',
                'value': null
              },
              {
                'attributeName': 'referenceCkTypeId',
                'value': null
              },
              {
                'attributeName': 'associationRoleId',
                'value': null
              },
              {
                'attributeName': 'recordColumns',
                'value': null
              },
              {
                'attributeName': 'hidden',
                'value': null
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'listColumns',
        'value': [
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'rtWellKnownName'
              },
              {
                'attributeName': 'label',
                'value': 'Name'
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': null
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Host'
              },
              {
                'attributeName': 'label',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': 'mono'
              }
            ]
          },
          {
            'ckRecordId': 'System.UI/EntityFormColumn',
            'attributes': [
              {
                'attributeName': 'attributePath',
                'value': 'Username'
              },
              {
                'attributeName': 'label',
                'value': null
              },
              {
                'attributeName': 'width',
                'value': null
              },
              {
                'attributeName': 'display',
                'value': null
              }
            ]
          }
        ]
      },
      {
        'attributeName': 'rtBlueprintSource',
        'value': 'System.UI.EntityForms-1.0.0'
      },
      {
        'attributeName': 'rtBlueprintLocked',
        'value': true
      },
      {
        'attributeName': 'rtBlueprintAppliedAt',
        'value': '2026-10-05T20:48:47.14Z'
      }
    ]
  }
};

export const LIVE_SFTP_CK_TYPE: RawCkType = {
  'ckTypeId': {
    'fullName': 'System.Communication-3.39.0/SftpConfiguration-1'
  },
  'rtCkTypeId': 'System.Communication/SftpConfiguration',
  'isAbstract': false,
  'description': 'Configuration for connecting to an SFTP server. Supports password and private key authentication.',
  'baseType': {
    'rtCkTypeId': 'System/Configuration',
    'isAbstract': true,
    'baseType': {
      'rtCkTypeId': 'System/Entity',
      'isAbstract': true,
      'baseType': null
    }
  },
  'attributes': {
    'items': [
      {
        'attributeName': 'host',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/Host-1'
        },
        'attribute': {
          'description': 'The host name is the name of the server on which the external system is running.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'port',
        'attributeValueType': 'INTEGER',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/Port-1'
        },
        'attribute': {
          'description': 'The port number is the number of the port on which the external system is listening for incoming connections.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'username',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/Username-1'
        },
        'attribute': {
          'description': 'The username is the name of the user that is used to authenticate with the external system.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'password',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/Password-1'
        },
        'attribute': {
          'description': 'The password is the secret that is used to authenticate with the external system.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'privateKey',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/PrivateKey-1'
        },
        'attribute': {
          'description': 'The private key is a secret key that is used in asymmetric encryption to authenticate with the external system.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'privateKeyPassphrase',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/PrivateKeyPassphrase-1'
        },
        'attribute': {
          'description': 'The private key passphrase is a secret that is used to protect the private key.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'maxConcurrentConnections',
        'attributeValueType': 'INTEGER',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.Communication-3.39.0/MaxConcurrentConnections-1'
        },
        'attribute': {
          'description': 'The maximum number of concurrent connections is the maximum number of connections that can be established with an external system at the same time.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'rtBlueprintSource',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintSource-1'
        },
        'attribute': {
          'description': "Identifies the blueprint that created this entity (format: 'BlueprintName-Version'). Null if entity was created manually.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'rtBlueprintLocked',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintLocked-1'
        },
        'attribute': {
          'description': 'If true, the entity is managed by the blueprint and will be updated when the blueprint is updated. If false, user modifications are preserved.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'rtBlueprintAppliedAt',
        'attributeValueType': 'DATE_TIME',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintAppliedAt-1'
        },
        'attribute': {
          'description': 'Timestamp when the blueprint was applied to create or update this entity.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      }
    ]
  },
  'associations': {
    'in': {
      'all': [
        {
          'rtRoleId': 'System.Communication/Uses',
          'navigationPropertyName': 'UsedBy',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Configuration',
          'rtOriginCkTypeId': 'System.Communication/Pipeline'
        },
        {
          'rtRoleId': 'System/Related',
          'navigationPropertyName': 'RelatesFrom',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System/Entity'
        },
        {
          'rtRoleId': 'System.Bot/Configures',
          'navigationPropertyName': 'ConfiguredBy',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Bot/AttributeAggregateConfiguration'
        },
        {
          'rtRoleId': 'System.Communication/MapsFrom',
          'navigationPropertyName': 'MapsFrom',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/DataPointMapping'
        },
        {
          'rtRoleId': 'System.Communication/MapsTo',
          'navigationPropertyName': 'MapsTo',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/DataPointMapping'
        },
        {
          'rtRoleId': 'System.Communication/Tag',
          'navigationPropertyName': 'TaggedBy',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/Tag'
        }
      ]
    },
    'out': {
      'all': [
        {
          'rtRoleId': 'System/Related',
          'navigationPropertyName': 'RelatesTo',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System/Entity'
        }
      ]
    }
  }
};

export const LIVE_ENTITY_FORM_CK_TYPE: RawCkType = {
  'ckTypeId': {
    'fullName': 'System.UI-2.7.0/EntityForm-1'
  },
  'rtCkTypeId': 'System.UI/EntityForm',
  'isAbstract': false,
  'description': "Describes how the Refinery Studio lists, creates and edits entities of TargetCkTypeId (and, with IncludeDerivedTypes, its subtypes). Resolution: exact type first (tenant forms win over seeded ones, then Priority), then the nearest base type with IncludeDerivedTypes. The seeded form 'form-default' on System/Entity ends the chain, so every type has a form. Attributes a form does not mention are generated from CK metadata unless GenerateRemainingFields = false. Derives from UIElement (same as Branding, TreeNavigationConfiguration) — consistent with SystemUiCkModel convention.",
  'baseType': {
    'rtCkTypeId': 'System.UI/UIElement',
    'isAbstract': true,
    'baseType': {
      'rtCkTypeId': 'System/Entity',
      'isAbstract': true,
      'baseType': null
    }
  },
  'attributes': {
    'items': [
      {
        'attributeName': 'name',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/Name-1'
        },
        'attribute': {
          'description': 'Unique identifier name for the entity.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'description',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/Description-1'
        },
        'attribute': {
          'description': 'Further information on the item.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'targetCkTypeId',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.TargetCkTypeId-1'
        },
        'attribute': {
          'description': "Runtime CK type id this form describes (e.g. 'EnergyIQ/Space', 'System/Entity'). Required. Resolution prefers a form whose TargetCkTypeId equals the entity's type; otherwise the nearest base type whose form sets IncludeDerivedTypes = true.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'includeDerivedTypes',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.IncludeDerivedTypes-1'
        },
        'attribute': {
          'description': 'Whether the form also applies to subtypes of TargetCkTypeId that have no form of their own (the nearest base type wins). Absent = false: the form applies to TargetCkTypeId only.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'category',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Category-1'
        },
        'attribute': {
          'description': "Free-text grouping label for the type in the Studio's entity navigation (e.g. 'Energy', 'Configuration'). Absent = the type is listed under its CK model.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'icon',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Icon-1'
        },
        'attribute': {
          'description': "Optional icon name for the type's list and form header, resolved by the frontend against its known icon set. Absent = default entity icon.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'priority',
        'attributeValueType': 'INTEGER',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Priority-1'
        },
        'attribute': {
          'description': 'Tie-breaker when several forms target the same type at the same source level (tenant forms always win over seeded ones first); the highest Priority wins. Absent = 0.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'canCreate',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CanCreate-1'
        },
        'attribute': {
          'description': 'Whether the list view offers creating new entities of this type. Absent = true.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'canEdit',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CanEdit-1'
        },
        'attribute': {
          'description': 'Whether existing entities of this type can be edited; false renders the form read-only. Absent = true.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'canDelete',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CanDelete-1'
        },
        'attribute': {
          'description': 'Whether the list view offers deleting entities of this type. Absent = true.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'canDuplicate',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CanDuplicate-1'
        },
        'attribute': {
          'description': 'Whether the list view offers duplicating an entity (opens the create form prefilled with its values). Absent = false.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'canExport',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CanExport-1'
        },
        'attribute': {
          'description': 'Whether the list view offers exporting entities of this type. Absent = false.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'singleton',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Singleton-1'
        },
        'attribute': {
          'description': 'Whether the type is a per-tenant singleton: the Studio skips the list and opens the one entity (identified by SingletonWellKnownName) directly, creating it on first save. Absent = false.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'singletonWellKnownName',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.SingletonWellKnownName-1'
        },
        'attribute': {
          'description': "rtWellKnownName of the singleton entity when Singleton = true (e.g. 'TreeNavigation', 'MappingCoverage'). Ignored when Singleton is absent or false. Absent with Singleton = true = the first entity of the type is used.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'customComponent',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.CustomComponent-1'
        },
        'attribute': {
          'description': 'Key of a dedicated frontend component that replaces the generated form for this type (e.g. for editors the generic form cannot express). Unknown keys fall back to the generated form. Absent = generated form.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'generateRemainingFields',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.GenerateRemainingFields-1'
        },
        'attribute': {
          'description': 'Whether attributes of the target type that no EntityFormField mentions are generated from CK metadata and appended in an extra section titled GeneratedSectionTitle. false = only the listed Fields are shown. Absent = true.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'generatedSectionTitle',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.GeneratedSectionTitle-1'
        },
        'attribute': {
          'description': "Title of the section holding the generated remaining fields (see GenerateRemainingFields). Absent = a frontend default (e.g. 'Other').",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'sections',
        'attributeValueType': 'RECORD_ARRAY',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Sections-1'
        },
        'attribute': {
          'description': 'Sections (group boxes) the form is divided into; fields are assigned via EntityFormField.SectionKey. Absent / empty = a single generated section.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': {
            'ckRecordId': {
              'fullName': 'System.UI-2.7.0/EntityFormSection-1'
            }
          }
        }
      },
      {
        'attributeName': 'fields',
        'attributeValueType': 'RECORD_ARRAY',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.Fields-1'
        },
        'attribute': {
          'description': 'Per-attribute presentation and validation overrides. Absent / empty = every attribute is generated from CK metadata (when GenerateRemainingFields is not false).',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': {
            'ckRecordId': {
              'fullName': 'System.UI-2.7.0/EntityFormField-1'
            }
          }
        }
      },
      {
        'attributeName': 'listColumns',
        'attributeValueType': 'RECORD_ARRAY',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityForm.ListColumns-1'
        },
        'attribute': {
          'description': 'Columns of the entity list view, in definition order. Absent / empty = columns are derived from CK metadata.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': {
            'ckRecordId': {
              'fullName': 'System.UI-2.7.0/EntityFormColumn-1'
            }
          }
        }
      },
      {
        'attributeName': 'rtBlueprintSource',
        'attributeValueType': 'STRING',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintSource-1'
        },
        'attribute': {
          'description': "Identifies the blueprint that created this entity (format: 'BlueprintName-Version'). Null if entity was created manually.",
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'rtBlueprintLocked',
        'attributeValueType': 'BOOLEAN',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintLocked-1'
        },
        'attribute': {
          'description': 'If true, the entity is managed by the blueprint and will be updated when the blueprint is updated. If false, user modifications are preserved.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'rtBlueprintAppliedAt',
        'attributeValueType': 'DATE_TIME',
        'isOptional': true,
        'ckAttributeId': {
          'fullName': 'System-2.4.0/RtBlueprintAppliedAt-1'
        },
        'attribute': {
          'description': 'Timestamp when the blueprint was applied to create or update this entity.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      }
    ]
  },
  'associations': {
    'in': {
      'all': [
        {
          'rtRoleId': 'System/Related',
          'navigationPropertyName': 'RelatesFrom',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System/Entity'
        },
        {
          'rtRoleId': 'System.Bot/Configures',
          'navigationPropertyName': 'ConfiguredBy',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Bot/AttributeAggregateConfiguration'
        },
        {
          'rtRoleId': 'System.Communication/MapsFrom',
          'navigationPropertyName': 'MapsFrom',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/DataPointMapping'
        },
        {
          'rtRoleId': 'System.Communication/MapsTo',
          'navigationPropertyName': 'MapsTo',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/DataPointMapping'
        },
        {
          'rtRoleId': 'System.Communication/Tag',
          'navigationPropertyName': 'TaggedBy',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System.Communication/Tag'
        }
      ]
    },
    'out': {
      'all': [
        {
          'rtRoleId': 'System/Related',
          'navigationPropertyName': 'RelatesTo',
          'multiplicity': 'N',
          'rtTargetCkTypeId': 'System/Entity',
          'rtOriginCkTypeId': 'System/Entity'
        }
      ]
    }
  }
};

export const LIVE_ENTITY_FORM_SECTION_RECORD: RawCkRecord = {
  'ckRecordId': {
    'fullName': 'System.UI-2.7.0/EntityFormSection-1'
  },
  'isAbstract': false,
  'attributes': {
    'items': [
      {
        'attributeName': 'key',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Key-1'
        },
        'attribute': {
          'description': 'Stable identifier of the section, unique within the form; referenced by EntityFormField.SectionKey. Required.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'title',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Title-1'
        },
        'attribute': {
          'description': 'Heading shown for the section. Absent = Key is shown.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'description',
        'attributeValueType': 'STRING',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Description-1'
        },
        'attribute': {
          'description': 'Optional explanatory text shown below the section heading. Absent = no text.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'order',
        'attributeValueType': 'INTEGER',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Order-1'
        },
        'attribute': {
          'description': 'Ordering hint among sections (ascending). Absent = definition order, after sections with an explicit Order.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'collapsed',
        'attributeValueType': 'BOOLEAN',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Collapsed-1'
        },
        'attribute': {
          'description': 'Whether the section starts collapsed. Absent = false (expanded).',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      },
      {
        'attributeName': 'columns',
        'attributeValueType': 'INTEGER',
        'isOptional': false,
        'ckAttributeId': {
          'fullName': 'System.UI-2.7.0/EntityFormSection.Columns-1'
        },
        'attribute': {
          'description': 'Number of field columns in the section layout: 1 or 2. Absent = 1. Other values behave as 1.',
          'defaultValues': null,
          'metaData': null,
          'ckEnum': null,
          'ckRecord': null
        }
      }
    ]
  }
};
