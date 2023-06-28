export class EnumTuple<TValue = number> {
  id: string | undefined;
  name: TValue | undefined;
}

export class EnumReader<TValue = number> {
  constructor(private readonly value: Record<string, TValue>) {}

  public getNamesAndValues(): Array<EnumTuple<TValue>> {
    return this.getNames().map((n) => {
      return <EnumTuple<TValue>>{ name: this.value[n], id: n };
    });
  }

  public getNames(): string[] {
    return Object.keys(this.value);
  }

  private getObjValues(): TValue[] {
    return Object.keys(this.value).map((k) => this.value[k]);
  }
}
