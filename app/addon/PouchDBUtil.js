/*global Ext:false,PouchDB:false*,openerplib:false,futil:false,URI:false*/

Ext.define('Ext.proxy.PouchDBUtil',{
    alternateClassName: 'DBUtil',
    requires: [    
        'Ext.ux.Deferred'
    ],
    
    singleton: true,
    
    config: {
    },
                
    constructor: function(config) {
        this.callParent(arguments);
        this.databases = {};
    },
        
    /**
     * @return database
     */
    getDB: function(dbName) {    
        var self = this;
        var db = this.databases[dbName];
        if ( !db ) {
            /*
            db = new PouchDB(dbName, {size: 50,
                                      adapter: 'websql' });
            */     
                                            
            //db = new PouchDB(dbName, { adapter: 'websql' });
            db = new PouchDB(dbName);
            self.databases[dbName] = db;
        }
        return db;
    },  
    
    /**
     * @ return view build form domain
     */
    buildView: function(domain) {
      if (!domain) {
          return null;
      }
      
      var name = 'index';
      var keys = [];   
      var keyValues = [];      
      var tupl, op, value, field, i;
      var onlyKeys = true;
               
      // check if only keys     
      for (i=0; i<domain.length && onlyKeys;i++) {
          tupl = domain[i];
          
          if ( tupl.constructor === Array && tupl.length == 3) {
              field = tupl[0];
              op = tupl[1];
              value = tupl[2];   
                              
              if ( op === '=') {
                  name = name + "_" + field;
                  
                  // field or expression
                  if ( !field.startsWith("(") ) {
                       // it's an field
                       field="doc." + field;
                  }
                  
                  keys.push(field);      
                  keyValues.push(value || null);     
              } else {
                  onlyKeys = false;
              }
          } 
      }
      
      // if only keys
      // create index
      if ( onlyKeys ) {
          if ( keys.length === 1) {
              return {
                  name: name,
                  key: keyValues[0] || null,
                  index: {
                    map: "function(doc) { \n"+
                         "  var val = " + keys[0] +"; \n" +
                         "  if (val)  { \n" +
                         "    emit(val); \n" +
                         "  } else { \n" +
                         "    emit(null); " +
                         "  }" +
                         "}"
                  }                    
              };
          } else if ( keys.length > 0 ) {
              var fct = "function(doc) { \n" +
                        "  var key = []; \n" +
                        "  var val;\n";
                        
              for ( var keyI=0; keyI < keys.length; keyI++) {
                 fct +=
                   "  val = " + keys[keyI] +"; \n" +
                   "  if (val) { \n" +
                   "    key.push(val); \n" +
                   "  } else { \n" +
                   "    key.push(null); \n" +
                   "  } \n" +
                   "  \n";               
              }
              
              fct += "  emit(key);\n";
              fct += "}\n";
              
              return {
                  name: name,
                  key: keyValues,
                  index: {
                    map: fct
                  }       
              };
          }
      }
      /*
      else {
          // TODO TEST !!!
          
          // build search
          var search = [];
          var paramIndex = 0;
          
          // link
          var link;
          var linkStack = [];
          var stmtCount = 0;
          
          // check if only keys     
          for (i=0; i<domain.length;i++) {
              tupl = domain[i];
              
              if ( tupl.constructor === Array && tupl.length == 3) {
                  // get link
                  if ( linkStack.length > 0 ) {
                      link = linkStack.pop();
                  } else {
                      link = "&&";
                  }
              
                  // get values
                  field = tupl[0];
                  op = tupl[1];
                  value = tupl[2];   
                
                  // start new statement
                  if ( search.length > 0 ) {
                      search.push(link);
                  } 
                  search.push("(");
                  stmtCount++;
                  
                  // evalute operator
                  if ( op === '=') {     
                      search.push("doc." + field + " === " + JSON.stringify(value));
                      //keys.push(value[field]);
                  } else if (op === 'ilike' ) {
                      search.push("doc." + field + ".lower().indexOf(" + JSON.stringify(value.lower()) +") >= 0");
                      //keys.push(value[field]);
                  } else {
                      // operator not found
                      search.push("1==1");
                  }
              } else if ( tupl == '|' )  {
                  linkStack.push('||');
              } else if ( tupl == '&') {
                  linkStack.push('&&');
              }
          }
          
          if ( stmtCount > 0 ) {
              for ( i=0; i<stmtCount; i++ ) {
                    search.push(")");
              }
              
              var condition = search.join(" "); 
              var fun = new Function('doc',
                     "if " + condition + " {\n" +
                     "  emit(doc._id)\n" +
                     "}\n"
                    );
                     
              return {
                  name: 'search',
                  fun: fun                 
              };
        }
      }*/

      return null;
    },  
    
    search: function(db, domain, params, callback) {    
        var self = this;
        var view = params.view || self.buildView(domain);
        
        var deferred = null;
        if ( !callback ) {
            deferred = Ext.create('Ext.ux.Deferred');
            callback = function(err, res) {
                if (err) {
                    deferred.reject(err);
                } else if (res) {
                    deferred.resolve(res);
                } else {
                    deferred.resolve();
                }
            };
        }
        
        if (view !== null) {
            if ( view.name == 'search' ) {
                // default query
                db.query(view.fun, params, callback);
            } else {
                // index based query
                // copy params
                params = JSON.parse(JSON.stringify(params));
                params.key = view.key;
                db.query(view.name, params, function(err, res) {                
                    if ( !err ) {
                        // no error result was successfull
                        if (callback) {
                            callback(err, res);
                        }
                    } else {
                        //create view doc
                        var doc = {
                            _id: "_design/" + view.name,
                            views: {                            
                            }
                        };
                        doc.views[view.name]=view.index;
                        //put doc
                        db.put(doc, function(err, res) {
                            if (err) {
                                // error on create index
                                if (callback) {
                                    callback(err, null);
                                }
                            } else {
                                // query again
                                db.query(view.name, params, callback);
                            }
                        });          
                    }
                        
                });       
            }
        } else {
           // query all
           db.allDocs(params, callback);
        } 

        if ( deferred ) 
            return deferred.promise();
            
        return null;
    },
    
    /**
     * search all parents
     */
    findParents: function(db, parent_uuid, callback, parent_list) {
        var self = this;
        
        if ( !parent_list ) {
            parent_list = [];
        }
        
        // check not found
        if ( !parent_uuid ) {
            callback(null,null);
            return;
        }
        
        db.get(parent_uuid).then(function(doc) {
            parent_list.push(doc);
            if ( doc.parent_id ) {
                self.findParents(db, doc.parent_id, callback, parent_list);
            } else {
                callback(null, parent_list);
            }
        })['catch'](function(err) {
            callback(err);
        });      
    },
    
    /**
     * search first child where the passed domain match
     * also search up in the parent tree
     */
    findFirstChild: function(db, parent_uuid, parent_field, domain, callback) {    
        var self = this;        
        
        // check not found
        if ( !parent_uuid ) {
            callback(null,null);
            return;
        }
        
        var searchDomain =  [["parent_id","=",parent_uuid]];
        if ( domain ) {            
            searchDomain = searchDomain.concat(domain);
        }
        
        self.search(db, searchDomain, {'include_docs':true}, function(err, res) {
             if ( !err && res ) {
                 if ( res.rows.length > 0 ) {
                     callback(null, res.rows[0].doc);
                 } else {
                     db.get(parent_uuid).then(function(doc) {                     
                         self.findFirstChild(db, doc[parent_field], parent_field, domain, callback);
                     })['catch'](function(err) {
                        callback(err); 
                     });
                 }
            } else {
                callback(err);
            }
        });
    },
    
    /**
     * deep data copy (without _id and _rev)
     */
    createClone: function(data) {
          if ( !data ) 
            return data;
                        
          var dumps = JSON.stringify(data, function(key, value) {
             if (key == '_id') {
                 return undefined;
             } else if ( key == '_rev') {
                 return undefined;
             } else if ( key == 'create_uid') {
                 return undefined;
             } else if ( key == 'write_uid') {
                return undefined;
             } else {
                 return value;
             }             
          });
          return JSON.parse(dumps);
          
    },
    
    cascadeDelete: function(db, parent_uuid, parent_field, callback) {       
        var self = this;
        
        var opCount=1;
        var opCallback = function(err,res) {
            if ( --opCount === 0) {
                if (callback) {
                    callback(err,res);
                }
            }
        };
        
        var searchDelete = function(uuid) {
            self.search(db, [[parent_field,"=",uuid]], {'include_docs':true}, function(err, res) {
                 if (!err) {                    
                    opCount += res.rows.length;
                    Ext.each(res.rows, function(row) {
                        db.remove(row.doc, {}, function(err, res) {
                            searchDelete(row.doc._id);                            
                        });                        
                    });
                 }
                 opCallback(err,res);
            });
        }; 

        searchDelete(parent_uuid);     
    },
    
    deepChildCopy: function(db, new_parent_uuid, template_uuid, parent_field, defaults, callback ) {
        var self = this;
        self.search(db, [[parent_field,"=",template_uuid]], {'include_docs':true}, function(err, res) {
            if ( err ) {
                callback(err);
            } else {
                var rows = res.rows;
                
                var operationCount = rows.length+1;
                var operationCallback = function(err, res) {
                    if ( --operationCount === 0 ) {
                        callback(err, res);
                    }
                };
                
                Ext.each(rows, function(row) {
                   // prepare copy
                   var template_child_uuid = row.doc._id;
                   var child = row.doc;
                   delete child._id;
                   delete child._rev;
                   child[parent_field]=new_parent_uuid;
                   
                   // copy defaults
                   if ( defaults ) {                    
                       for ( var key in defaults) {
                           child[key] = defaults[key];
                       }
                   }
                   
                   // create copy
                   db.post(child, function(err, res) {
                        if ( !err ) {
                            self.deepChildCopy(db, res.id, template_child_uuid, parent_field, defaults, operationCallback);
                        } else {
                            operationCallback(err, res);
                        }               
                   });       
                });
                
                operationCallback(err, res);
            }
        });
    },
    
    resetDB: function(dbName, callback) {
        var self = this;
        var db = self.getDB(dbName);        
        delete self.databases[dbName];
        db.destroy(callback);
    },

    syncWithOdoo: function(db, client, sync_config) {
        var deferred = Ext.create('Ext.ux.Deferred');
        // invoke before sync
        client.invoke("jdoc.jdoc","jdoc_couchdb_before",[sync_config])
            ['catch'](function(err) {
                deferred.reject(err);               
            }).then(function(couchdb_config) {
                // get couchdb link
                var password = client.getClient()._password;                                
                var target_url = URI(couchdb_config.url)
                    .username(couchdb_config.user)
                    .password(password)
                    .toString()+couchdb_config.db;
                                
                // sync with couchdb
                db.sync(target_url)
                    ['catch'](function(err) {
                        deferred.reject(err); 
                    }).then(function(sync_res) {

                        // invoke database sync
                        client.invoke("jdoc.jdoc","jdoc_couchdb_sync",[sync_config])
                            ['catch'](function(err) {
                                deferred.reject(err);
                            }).then(function(couchdb_config) {

                                // sync again with couchdb                            
                                db.sync(target_url)
                                    ['catch'](function(err) {
                                        deferred.reject(err); 
                                    }).then(function(sync_res) {
                                            
                                        // finish database sync
                                        client.invoke("jdoc.jdoc","jdoc_couchdb_after",[sync_config])
                                            ['catch'](function(err) {
                                                deferred.reject(err);
                                            }).then(function(couchdb_config) {
                                                deferred.resolve(sync_res); 
                                            });
                                    });                                
                            });                                                
                    });
            });

        return deferred.promise();
    }
    
});