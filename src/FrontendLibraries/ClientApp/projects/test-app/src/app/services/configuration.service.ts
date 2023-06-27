import { Injectable } from '@angular/core';
import { ConfigurationDto } from '../models/configurationDto';

@Injectable()
export class ConfigurationService {
  private configuration: ConfigurationDto;

  constructor() {
    this.configuration = <ConfigurationDto>{

    };
  }

  public get config(): ConfigurationDto {
    return this.configuration;
  }

  public async loadConfig() {
    console.debug('loading config');

    const result = await fetch('/_configuration');
    if (!result.ok) {
      throw new Error('Could not load configuration.\'');
    }

    this.configuration = <ConfigurationDto> await result.json();

    console.debug('end loading config function');
  }
}
