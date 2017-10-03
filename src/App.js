import React, { Component } from 'react';
import { PyroclastDeploymentClient } from 'pyroclast';
import c3 from 'c3';
import { chartResourceFactory } from './chart-resource';
import { timeseries, categories } from './transform-c3';
import './App.css';
import 'c3/c3.css';

class C3Chart extends Component {
  componentDidMount() {
    let {spec} = this.props;

    let chart = c3.generate({
      bindto: this.el,
      ...spec
    });

    this.setState({chart});
  }

  componentDidUpdate(prevProps, prevState) {
    this.state.chart.load({
      ...this.props.spec.data,
      unload: prevProps.spec.data.columns.map(([name]) => name)
    });
  }

  componentWillUnmount(){
    this.state.chart && this.state.chart.destroy();
  }

  render() {
    return (<div ref={(el) => {this.el = el;}}></div>);
  }
}

const configsInputPlaceholder = [{
  readApiKey: '<read api key>',
  deploymentId: '<deployment id>',
  region: 'us-west-1'
}];

class ConfigsInput extends Component {
  constructor() {
    super();

    this.state = {
      rawInput: null
    };
  }
  
  render() {
    let {onChange} = this.props;
    let {rawInput, invalid} = this.state;

    let placeholder = !rawInput
          && JSON.stringify(configsInputPlaceholder, null, 2);
    
    return (
      <textarea
         className={"configs-input" + (invalid ? ' invalid' : '')}
         value={rawInput}
         placeholder={placeholder}
         onChange={(e) => {
           let v = e.target.value;
           this.setState({rawInput: v});
           try {
             let configs = JSON.parse(v);
             configs = Array.isArray(configs) ? configs : [configs];
             onChange(configs);
             this.setState({invalid: false})
           } catch (e) {
             this.setState({invalid: true})
        }}}/>
    );
  }
}

class SelectDimensions extends Component {
  constructor() {
    super();

    this.state = {
      enabled: new Set()
    };
  }
  
  render() {
    let {resources, onChange, windowed} = this.props;
    let {enabled} = this.state;
    
    let byNs = resources
          .reduce((m, r) => m.set(r.ns(), r), new Map());

    let toggle = (checked, resNs, dimNs) => {
      if (dimNs) {
        if (checked) {
          enabled.add(dimNs);
          
        } else {
          enabled.delete(resNs);
          enabled.delete(dimNs);          
        }
      } else {
        if (checked) {
          enabled = [...byNs.get(resNs).dimensions().keys()]
            .reduce((s, dimNs) => s.add(dimNs),
                    enabled.add(resNs));
        } else {
          enabled.delete(resNs);
          [...byNs.get(resNs).dimensions().keys()]
            .forEach((dimNs) => enabled.delete(dimNs));          
        }
      }

      this.setState({enabled});
      
      let enabledDimensions = resources
            .map((r) => Array.from(r.dimensions())
                 .filter(([ns, d]) => enabled.has(ns))
                 .map(([ns, d]) => d))
            .reduce((agg, ds) => agg.concat(ds),
                    []);

      onChange(enabledDimensions);
    }

    let dimensionSelectItems = Array.from(byNs)
          .map(([resNs, r]) => {
            let disabled = typeof windowed === "boolean" && windowed !== r.windowed;
            let dimensions = Array.from(r.dimensions())
                  .map(([dimNs, {name, windowed}]) => (
                    <li key={dimNs}>
                      <label>
                        <input type="checkbox"
                               checked={enabled.has(dimNs)}
                               disabled={disabled}
                               onChange={(e) => toggle(e.target.checked, resNs, dimNs)}/>
                        <span>{name}</span>
                      </label>
                    </li>
                  ));

            return (
              <li key={r.name}
                  className={disabled ? 'disabled' : ''}
                  title={disabled ? 'Not compatible with selected data.' : ''}>
                <div>
                  <label>
                    <input type="checkbox"
                           checked={enabled.has(resNs)}
                           disabled={disabled}
                           onChange={(e) => toggle(e.target.checked, resNs)}/>
                    <span className="resource-name">{r.name}</span>
                    <span className="caption">{r.windowed ? 'time series' : 'categories'}</span>
                  </label>
                  <ul className="dimensions">
                    {dimensions}
                  </ul>
                </div>
              </li>
            );
          })

    return (
      <div className="select-dimensions">
        <em>Select resources & groups</em>
        <ul className="resources">{dimensionSelectItems}</ul>  
      </div>
    );
  }
}

function fetchAggregateChartResources(configs) {
  let fetches = configs
        .map((config) => new PyroclastDeploymentClient(config))
        .map((client) => client
             .readAggregates()
             .then((aggs) => Object.keys(aggs)
                   .map((name) => chartResourceFactory({...aggs[name], name, client}))));

  return Promise.all(fetches)
    .then((xs) => xs
          .reduce((flat, x) => flat.concat(x), []));
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      configs: null,
      resources: null,
      fetchError: null,
      enabledDimensions: [],
      panelOpen: true
    };
  }
  
  fetchResources() {
    try {
      fetchAggregateChartResources(this.state.configs)
        .then((resources) => this.setState({resources}),
              (fetchError) => this.setState({fetchError}));
    } catch(fetchError) {
      this.setState({fetchError, resources: null});
    }
  }

  render() {
    let {configs, resources, fetchError, enabledDimensions, panelOpen} = this.state;
    let windowed = enabledDimensions[0] && enabledDimensions[0].windowed;

    let chart, selectDimensions;

    if(enabledDimensions.length) {
      if(windowed) {
        chart = (<C3Chart spec={timeseries(enabledDimensions)} />)
      } else if(enabledDimensions.length === 1 && enabledDimensions[0].singleValue) {
        
      } else {
        chart = (<C3Chart spec={categories(enabledDimensions)} />)
      }
    }

    if(resources) {
      selectDimensions = (
        <SelectDimensions resources={resources}
                          windowed={windowed}
                          onChange={(enabledDimensions) => this.setState({enabledDimensions})} />);
    }
    
    return (
      <div className="aggregate-charting">
        <details className="config-container"
                 open={panelOpen}
                 onToggle={(e) => this.setState({panelOpen: e.target.open})}>
          <summary>
            configure
          </summary>
          <div className="config-content">
            <em>Specify endpoints (JSON)</em>
            <ConfigsInput onChange={(configs) => this.setState({configs})} />
            <button disabled={!configs || !configs[0]} onClick={(_) => this.fetchResources()}>
                Apply config
            </button>
            {fetchError && (<span className="error">{fetchError.message}</span>)}
            {selectDimensions}
          </div>
        </details>
        <div className={'stage' + (panelOpen ? '' : ' full-width')}>          
          {chart}
         </div>
      </div>
    );
  }
}

export default App;
