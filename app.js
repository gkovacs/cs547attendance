// Generated by LiveScript 1.5.0
(function(){
  var fs, getsecret, koa, koaStatic, koaRouter, koaLogger, GoogleSpreadsheet, debounce, ref$, cfy, yfy, add_noerr, kapp, app, memoizeSingleAsync, sleep, to_dict_list, creds, get_sheet, get_spreadsheet_real, get_spreadsheet, get_seminars_attended_by_user, list_all_users, port;
  fs = require('fs');
  getsecret = require('getsecret');
  koa = require('koa');
  koaStatic = require('koa-static');
  koaRouter = require('koa-router');
  koaLogger = require('koa-logger');
  GoogleSpreadsheet = require('google-spreadsheet');
  debounce = require('promise-debounce');
  ref$ = require('cfy'), cfy = ref$.cfy, yfy = ref$.yfy, add_noerr = ref$.add_noerr;
  kapp = koa();
  kapp.use(koaLogger());
  app = koaRouter();
  memoizeSingleAsync = function(func){
    var debounced_func, cached_val;
    debounced_func = debounce(yfy(func));
    cached_val = null;
    return cfy(function*(){
      var result;
      if (cached_val != null) {
        return cached_val;
      }
      result = (yield debounced_func());
      cached_val = result;
      return result;
    });
  };
  sleep = cfy(function*(time){
    var sleep_base;
    sleep_base = function(msecs, callback){
      return setTimeout(callback, msecs);
    };
    return (yield yfy(sleep_base)(time));
  });
  to_dict_list = function(cells){
    var output, header_cells, body_cells, col_to_name, i$, len$, item, row_idx_to_contents, idx, name, value;
    output = [];
    header_cells = cells.filter(function(x){
      return x.row === 1;
    });
    body_cells = cells.filter(function(x){
      return x.row !== 1;
    });
    col_to_name = {};
    for (i$ = 0, len$ = header_cells.length; i$ < len$; ++i$) {
      item = header_cells[i$];
      col_to_name[item.col] = item.value;
    }
    row_idx_to_contents = [];
    for (i$ = 0, len$ = body_cells.length; i$ < len$; ++i$) {
      item = body_cells[i$];
      idx = item.row - 2;
      name = col_to_name[item.col];
      value = item.value;
      if (row_idx_to_contents[idx] == null) {
        row_idx_to_contents[idx] = {};
      }
      row_idx_to_contents[idx][name] = value;
    }
    return row_idx_to_contents;
  };
  creds = JSON.parse(getsecret('google_service_account'));
  get_sheet = memoizeSingleAsync(cfy(function*(){
    var doc, info, sheet;
    doc = new GoogleSpreadsheet(getsecret('spreadsheet_id'));
    (yield add_noerr(function(it){
      return doc.useServiceAccountAuth(creds, it);
    }));
    info = (yield doc.getInfo);
    sheet = info.worksheets[0];
    return sheet;
  }));
  get_spreadsheet_real = cfy(function*(){
    var sheet, cells;
    sheet = (yield get_sheet());
    cells = (yield sheet.getCells);
    return to_dict_list(cells);
  });
  get_spreadsheet = null;
  (function(){
    var last_time_fetched, cached_spreadsheet_results;
    last_time_fetched = 0;
    cached_spreadsheet_results = null;
    return get_spreadsheet = cfy(function*(){
      var current_time;
      current_time = Date.now();
      if (Math.abs(current_time - last_time_fetched) < 30000) {
        return cached_spreadsheet_results;
      }
      cached_spreadsheet_results = (yield get_spreadsheet_real());
      last_time_fetched = current_time;
      return cached_spreadsheet_results;
    });
  })();
  get_seminars_attended_by_user = cfy(function*(sunetid){
    var spreadsheet, output, output_set, i$, len$, line, cur_sunetid, seminar;
    sunetid = sunetid.trim().toLowerCase();
    spreadsheet = (yield get_spreadsheet());
    output = [];
    output_set = {};
    for (i$ = 0, len$ = spreadsheet.length; i$ < len$; ++i$) {
      line = spreadsheet[i$];
      cur_sunetid = line['SUNet ID'];
      if (cur_sunetid == null) {
        continue;
      }
      if (cur_sunetid.trim().toLowerCase() !== sunetid) {
        continue;
      }
      seminar = line['Which seminar are you currently attending?'];
      if (output_set[seminar] != null) {
        continue;
      }
      output_set[seminar] = true;
      output.push(seminar);
    }
    return output;
  });
  list_all_users = cfy(function*(){
    var spreadsheet, output, output_set, i$, len$, line, sunetid;
    spreadsheet = (yield get_spreadsheet());
    output = [];
    output_set = {};
    for (i$ = 0, len$ = spreadsheet.length; i$ < len$; ++i$) {
      line = spreadsheet[i$];
      sunetid = line['SUNet ID'].trim().toLowerCase();
      if (output_set[sunetid] != null) {
        continue;
      }
      output.push(sunetid);
      output_set[sunetid] = true;
    }
    output.sort();
    return output;
  });
  app.get('/attendance', function*(){
    var sunetid, seminars;
    sunetid = this.request.query.sunetid;
    if (sunetid == null) {
      this.body = JSON.stringify([]);
      return;
    }
    seminars = (yield get_seminars_attended_by_user(sunetid));
    return this.body = JSON.stringify(seminars);
  });
  app.get('/pass_nopass', function*(){
    var output, all_users, i$, len$, user, seminars_attended, passed;
    output = [];
    all_users = (yield list_all_users());
    for (i$ = 0, len$ = all_users.length; i$ < len$; ++i$) {
      user = all_users[i$];
      seminars_attended = (yield get_seminars_attended_by_user(user));
      passed = seminars_attended.length >= 9;
      output.push(user + ": " + passed);
    }
    return this.body = output.join('\n');
  });
  /*
  do cfy ->*
    results = yield get_seminars_attended_by_user('gkovacs')
    console.log results
    results = yield get_seminars_attended_by_user('gkovacs2')
    console.log results
  */
  /*
  do cfy ->*
    results = yield get_spreadsheet()
    console.log results
    results = yield get_spreadsheet()
    console.log results
    yield sleep(6000)
    results = yield get_spreadsheet()
    console.log results
  */
  kapp.use(app.routes());
  kapp.use(app.allowedMethods());
  kapp.use(koaStatic(__dirname + '/www'));
  port = (ref$ = process.env.PORT) != null ? ref$ : 5000;
  kapp.listen(port);
  console.log("listening to port " + port + " visit http://localhost:" + port);
}).call(this);
