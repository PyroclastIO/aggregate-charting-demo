
export class ChartResource {
  constructor({id, name, type, grouped, contents, client}) {
    this.id = id;
    this.shalike = id.split('-')[0];
    this.name = name;
    this.type = type;
    this.windowed = type !== 'global';
    this.grouped = grouped;
    this.singleValue = !this.windowed && !grouped;
    this.contents = contents;
    this.client = client;
    this.ts = Date.now();
  }

  refresh() {
    return this.client.readAggregate(this.name)
      .then(({contents}) => {
        this.contents = contents;
        this.ts = Date.now();
        return this;
      });
  }

  ns(...parts) {
    return [this.shalike, this.name, ...parts].join('::');
  }

  dimensions() {
    return new Map([
      [this.ns('values'), {
        name: 'values',
        data: {ys: [this.contents[0].value]},
        resource: this,
        windowed: this.windowed
      }]
    ]);
  }

  bounds() {
    return [];
  }
}

export class GroupedChartResource extends ChartResource {
  dimensions() {
    return Object.keys(this.contents)
      .reduce((m, k) =>
              m.set(this.ns(k || '<default>'), {
                name: k || '<default>',
                data: {ys: this.contents[k].map(({value}) => value)},
                resource: this,
                windowed: this.windowed
              }),
              new Map());
  }
}

export class WindowedChartResource extends ChartResource {
  dimensions() {
    let data = this.contents
          .reduce(({xs, ys}, {bounds, value}) => ({
            xs: xs.concat(bounds),
            ys: ys.concat([value, value])
          }), {xs: [], ys: []});

    return new Map([
      [this.ns('values'), {
        name: 'values',
        data,
        resource: this,
        windowed: this.windowed
      }]
    ]);
  }
}

export class WindowedAndGroupedChartResource extends ChartResource {
  dimensions() {
    return Object.keys(this.contents)
      .reduce((m, k) => {
        let data = this.contents[k]
              .reduce(({xs, ys}, {bounds, value}) => ({
                xs: xs.concat(bounds),
                ys: ys.concat([value, value])
              }), {xs: [], ys: []});
        
        return m.set(this.ns(k || '<default>'), {
          name: k || '<default>',
          data,
          resource: this,
          windowed: this.windowed
        });
      }, new Map());
  }
}

export function chartResourceFactory(agg) {
  let windowed = agg.type !== 'global';

  if(agg.grouped) {
    if(windowed) {
      return new WindowedAndGroupedChartResource(agg);
    }
    return new GroupedChartResource(agg);
  }

  if(windowed) {
    return new WindowedChartResource(agg);
  }
  return new ChartResource(agg);
}
