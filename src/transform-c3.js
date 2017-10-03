
export function timeseries(dimensions) {
  let {xs, columns, names} = dimensions
        .reduce((agg, {name, data, resource}) => {
          let {xs, ys} = data;

          if(!xs) {
            return agg;
          }
          
          let xns = resource.ns(name, 'xs');
          let yns = resource.ns(name, 'ys');
          
          agg.xs[yns] = xns;

          // fill gaps because c3 interprets holes as y2=y1,
          // where we need y=0
          let {xs2, ys2} = xs.reduce(({xs2, ys2}, x, idx) => {
            let y = ys[idx];

            if(idx === 0) {
              return {
                xs2: xs2.concat([x - 1, x]),
                ys2: ys2.concat([0, y])
              };
            }

            if(idx === xs.length - 1) {
              return {
                xs2: xs2.concat([x, x + 1]),
                ys2: ys2.concat([y, 0])
              };
            }
            
            if(idx !== 0 && idx % 2 === 0) {
              let lx = xs[idx - 1];
              let gap = x - lx;

              if(gap > 1) {
                return {
                  xs2: xs2.concat([lx + 1, x - 1, x]),
                  ys2: ys2.concat([0, 0, y])
                };
              }              
            }

            return {
              xs2: xs2.concat([x]),
              ys2: ys2.concat([y])
            };           
          }, {xs2: [], ys2: []});
          
          agg.columns = agg.columns.concat([
            [xns, ...xs2.map((x) => new Date(x))],
            [yns, ...ys2]
          ]);

          agg.names[yns] = name;

          return agg;
        }, {xs: {}, columns: [], names: {}})

  return {
    data: {
      xs,
      columns,
      names,
      type: 'area'
    },
    axis: {
      x: {
        type: 'timeseries',
        tick: {
          format: '%Y-%m-%d %H:%M:%S',
          count: 20
        }
      }
    },
    // tooltip: {
    //   format: {
    //     title: (d) => d.getTime()
    //   }
    //   },
    point: {show: false},
    grid: {x: {show: true}},
    zoom: {enabled: true}
  };
}

export function categories(dimensions) {
  let {columns, names} = dimensions
        .reduce((agg, {name, data, resource}) => {
          let {xs, ys} = data;

          if(xs) {
            return agg;
          }
          
          let yns = resource.ns(name);
          
          agg.columns = agg.columns.concat([
            [yns, ...ys]
          ]);

          agg.names[yns] = name;
          
          return agg;
        }, {columns: [], names: {}})

  return {
    data: {
      columns,
      names,
      type: 'bar'
    },
    axis: {
      x: {
        type: 'category'
      }
    }
  };
}
