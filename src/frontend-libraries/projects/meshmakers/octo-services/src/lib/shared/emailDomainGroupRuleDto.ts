export interface EmailDomainGroupRuleDto {
  rtId?: string;
  emailDomainPattern?: string;
  targetGroupRtId?: string;
  description?: string;
}

export interface EmailDomainGroupRulesResult {
  emailDomainGroupRules?: EmailDomainGroupRuleDto[];
}
