import { ckTypeShortName, humanizeCkTypeName } from './ck-type-name';

describe('humanizeCkTypeName (AB#5524)', () => {
  it.each([
    ['System.Communication/EMailReceiverConfiguration', 'E-mail receiver configuration'],
    ['System.Communication/EMailSenderConfiguration-1', 'E-mail sender configuration'],
    ['Meshmakers.Accounting/FinApiConfiguration', 'finAPI configuration'],
    ['System.Communication/SapConfiguration', 'SAP configuration'],
    ['System.Communication/SftpConfiguration', 'SFTP configuration'],
    ['System.Ai/AiAgentConfig', 'AI agent config'],
    ['Energy.Community/EdaConfiguration', 'EDA configuration'],
    ['Meshmakers.Accounting/WeClappConfiguration', 'weclapp configuration'],
    ['System.Communication/HelmRepository', 'Helm repository'],
    ['System.Communication/GraphEMailConfiguration', 'Graph e-mail configuration'],
    ['System.Communication/SAPConnection', 'SAP connection'],
    ['System.Communication/OpcUaServer', 'OPC UA server'],
    ['System.Ai/OpenAiConfiguration', 'OpenAI configuration'],
    ['SftpConfiguration', 'SFTP configuration'],
  ])('%s → %s', (input, expected) => {
    expect(humanizeCkTypeName(input)).toBe(expected);
  });

  it('does not treat words that merely start with an acronym as one', () => {
    expect(humanizeCkTypeName('X/Aidan')).toBe('Aidan');
    expect(humanizeCkTypeName('X/MailBox')).toBe('Mail box');
  });

  it('returns the input when it holds no name', () => {
    expect(humanizeCkTypeName('')).toBe('');
  });

  it('ckTypeShortName drops the model and the version', () => {
    expect(ckTypeShortName('System.Communication/SftpConfiguration-1')).toBe('SftpConfiguration');
    expect(ckTypeShortName('SftpConfiguration')).toBe('SftpConfiguration');
  });
});
