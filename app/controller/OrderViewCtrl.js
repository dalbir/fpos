/*global Ext:false, DBUtil:false, PouchDB:false, openerplib:false, futil:false, Fpos:false, Config:false, ViewManager:false */
Ext.define('Fpos.controller.OrderViewCtrl', {
    extend: 'Ext.app.Controller',
    requires: [    
        'Ext.ux.Deferred',
        'Fpos.Config',
        'Ext.proxy.PouchDBUtil',
        'Fpos.view.OrderView',
        'Fpos.view.OrderLineFormView',
        'Fpos.view.OrderFormView',
        'Fpos.view.ScaleView'
    ],
    config: {
        refs: {
            orderView: '#orderView',
            posDisplay: '#posDisplayLabel',
            orderItemList: '#orderItemList',
            paymentItemList: '#paymentItemList',
            paymentPanel: '#paymentPanel',
            stateDisplay: '#posDisplayState',
            inputButtonAmount: '#inputButtonAmount',
            inputButtonDiscount: '#inputButtonDiscount',
            inputButtonPrice: '#inputButtonPrice',
            inputButtonPayment: '#inputButtonPayment',
            orderInputView: '#orderInputView',
            paymentSummary: '#paymentSummary'
        },
        control: {     
            orderView: {
                initialize: 'orderViewInitialize'
            },
            posDisplay: {
                initialize: 'posDisplayInitialize'
            },
            stateDisplay: {
                initialize: 'stateDisplayInitialize'  
            },
            orderItemList: {
                initialize: 'orderItemListInitialize',
                selectionchange: 'onItemSelectionChange'
            },
            paymentItemList: {
                initialize: 'paymentItemListInitialize',
                selectionchange: 'onPaymentSelectionChange'
            },
            orderInputView: {
                activeitemchange : 'orderInputActiveItemChange' 
            },
            'button[action=inputCancel]' : {
                tap: 'onInputCancelTap'
            },
            'button[action=inputModeSwitch]' : {
                tap: 'onInputModeSwitch'
            },
            'button[action=inputNumber]' : {
                tap: 'onInputNumber'
            },
            'button[action=editOrder]' : {
                tap: 'onEditOrder'
            },
            'button[action=inputCash]' : {
                tap: 'onCash'
            },
            'button[action=inputPayment]' : {
                tap: 'onPayment'
            },
            'button[action=createCashState]' : {
                tap: 'onCreateCashState'
            },
            'button[action=createCashOverview]' : {
                tap: 'onCashOverview'  
            },
            'button[action=printAgain]' : {
                tap: 'onPrintAgain'
            },
            'button[action=saveOrder]' :  {
                tap: 'onSaveOrder'
            }     
        }
    },
    
    init: function() {
        var self = this;
        
        this.place = null;
        this.order = null;
        this.printTemplate = null;
        this.paymentEnabled = false;
        this.initialLoad = false; 
        
        this.mode = '*';
        this.inputSign = 1; 
        this.inputText = '';
        this.roundFactor = Math.pow(10,Config.getDecimals());
        
        this.lineStore = Ext.StoreMgr.lookup("PosLineStore");
        this.orderStore = Ext.StoreMgr.lookup("PosOrderStore");
        this.taxStore = Ext.StoreMgr.lookup("AccountTaxStore");
        this.unitStore = Ext.StoreMgr.lookup("ProductUnitStore");
        this.paymentStore = Ext.StoreMgr.lookup("PosPaymentStore");
        this.placeStore = Ext.StoreMgr.lookup("PlaceStore");
        
        this.displayTask = Ext.create('Ext.util.DelayedTask', function() {
            self.display();
        });
    },    
    
    posDisplayInitialize: function(display) {
        display.setTpl(Ext.create('Ext.XTemplate',
           '{[futil.formatFloat(values.amount_total,Config.getDecimals())]}'
        ));
    },
    
    stateDisplayInitialize: function(display) {
        display.setTpl(Ext.create('Ext.XTemplate',
           '<div class="PosOrderState">',
               '<div class="PosOrderCurrency">',
               '{[Config.getCurrency()]}',
               '</div>',
               '<div class="PosOrderInfo">',
                  '<div class="PosOrderInfo2">',                        
                    '{name} <tpl if="ref"> / {ref}</tpl>',
                  '</div>',
                  '<div class="PosOrderInfo1">',
                    '<tpl if="partner">',
                    '{partner.name}',
                    '</tpl>',
                  '</div>',
               '</div>',
            '</div>'
        ));
    },
     
    orderItemListInitialize: function(orderItemList) {
        var self = this;
        orderItemList.setItemTpl(Ext.create('Ext.XTemplate',
                '<tpl if="!this.hasFlag(values,\'d\') && (tag || this.hasFlag(values,\'u\'))">',
                '<div class="PosOrderLineName">',
                    '{name}',
                '</div>',
                '<div class="PosOrderLinePrice">',
                     '{[futil.formatFloat(values.subtotal_incl,Config.getDecimals())]}',
                '</div>',
                '<tpl else>',
                '<div class="PosOrderLineDescription">',
                    '<div class="PosOrderLineName">',
                        '{name}',
                    '</div>',
                    '<div class="PosOrderLineAmount">',
                        '{[this.formatAmount(values)]}',
                        ' ',
                        '{[this.getUnit(values.uom_id)]}',
                        ' * ',
                        '{[futil.formatFloat(values.price,Config.getDecimals())]} {[Config.getCurrency()]}',
                        '<tpl if="netto">',
                          '<tpl if="qty != 0 && qty != 1">',
                          ' = <b>{[futil.formatFloat(values.subtotal,Config.getDecimals())]} {[Config.getCurrency()]}</b>',
                          '</tpl>',
                          ' ',
                          '<b>NETTO</b>',
                        '</tpl>',
                        ' ',
                        '<tpl if="discount &gt; 0.0">',
                            '<span class="PosOrderLineDiscount">',
                            '- {[futil.formatFloat(values.discount,Config.getDecimals())]} %',
                            '</span>',
                        '</tpl>',
                    '</div>',                    
                '</div>',
                '<div class="PosOrderLinePrice">',
                    '{[futil.formatFloat(values.subtotal_incl,Config.getDecimals())]}',
                '</div>', 
                '</tpl>',
                {                
                    getUnit: function(uom_id) {
                        var uom = self.unitStore.getById(uom_id);
                        return uom && uom.get('name') || '';
                    },
                    
                    formatAmount: function(values)  {
                        var dec = values.a_dec;
                        if ( dec < 0 ) {
                            return futil.formatFloat(values.qty, 0);
                        } else if ( dec > 0 ) {
                            return futil.formatFloat(values.qty, dec);
                        } else {
                            return futil.formatFloat(values.qty, Config.getQtyDecimals()); 
                        }
                    },
                    
                    hasTag: function(values, tag) {
                        if ( !tag ) {
                            return values.tag ? true : false;
                        } else if ( !values.tag ) {
                            return false;
                        } else {
                            return values.tag == tag;
                        }
                    },
                    
                    hasFlag: function(values, flag) {
                        if ( !flag) {
                            return values.flags ? true : false;
                        } else if ( !values.flags ) {
                            return false;
                        } else {
                            return values.flags.indexOf(flag) > -1;
                        }
                    }
                    
                }
        ));        
        orderItemList.setStore(this.lineStore);
    },    

    paymentItemListInitialize: function(paymentItemList) {
        var self = this;
        paymentItemList.setItemTpl(Ext.create('Ext.XTemplate',
                '<div class="PaymentName">',
                    '{journal.name}',
                '</div>',
                '<div class="PaymentValue">',
                    '{[futil.formatFloat(values.payment)]}',
                '</div>'
        ));        
        paymentItemList.setStore(this.paymentStore);
    },
     
    orderViewInitialize: function() {
        var self = this;          
        
        // reload event
        Ext.Viewport.on({
            scope: self,
            reloadData: self.fullDataReload
        });

        // product input event         
        Ext.Viewport.on({
            scope: self,
            productInput: self.productInput            
        });
        
        // place input
        Ext.Viewport.on({
            scope: self,
            placeInput: self.placeInput
        });    
        
        // validation event         
        Ext.Viewport.on({
            scope: self,
            validateLines: self.validateLines            
        });
        
        Ext.Viewport.on({
            scope: self,
            posKey: self.onKeyDown
        });
        
        Ext.Viewport.on({
            scope: self,
            userChange: self.onUserChange
        });
        
        // reload data
        self.reloadData();
    },
    
    placeInput: function(place) {
        this.place = place;
        this.reloadData();
    },
    
    productInput: function(product) {
        var self = this;
        if ( self.isEditable() ) {
            
            var changedLine = null;
            var profile = Config.getProfile();
            
            var toWeight = product.get('to_weight');
            var noGroup = toWeight || profile.iface_nogroup || product.get('pos_nogroup') || false;
            
            if ( !noGroup ) {
                self.lineStore.each(function(line) {
                    if ( line.get('product_id') === product.getId() ) {
                        // update quantity
                        line.set('qty',(line.get('qty') || 0.0) + 1);
                        changedLine = line;
                        return false; //stop iteration
                    }
                });
            }
            
            if ( !changedLine ) {
                var db = Config.getDB();
                // build values
                var values = {
                    //'order_id' : self.order.getId(),
                    'name' : product.get('name'),
                    'product_id' : product.getId(),
                    'uom_id' : product.get('uom_id'),
                    'tax_ids' : product.get('taxes_id'),
                    'netto' : product.get('netto'),
                    'price' : product.get('price'),
                    'qty' : toWeight ? 0.0 : 1.0,
                    'subtotal_incl' : 0.0,
                    'subtotal' : 0.0,
                    'discount' : 0.0,
                    'sequence' : self.lineStore.getCount()
                };
                
                // determine flags
                var flags = '';
                if ( product.get('nounit') ) {
                    flags +="u";
                }
                if ( product.get('pos_minus') ) {
                    flags +="-";
                }
                if ( product.get('pos_price') ) {
                    flags +="p";
                }
                if ( flags.length > 0) {
                    values.flags = flags;
                }
                
                // amount
                var a_pre = product.get('pos_amount_pre');
                if ( a_pre > 0 || a_pre < 0 ) {
                    values.a_pre = a_pre;
                }
                var a_dec = product.get('pos_amount_dec');
                if ( a_dec > 0 || a_dec < 0 ) {
                    values.a_dec = a_dec;
                }
                
                // price
                var p_pre = product.get('pos_price_pre');
                if ( p_pre > 0 || p_pre < 0 ) {
                    values.p_pre = p_pre;
                }
                var p_dec = product.get('pos_price_dec');
                if ( p_dec > 0 || p_dec < 0 ) {
                    values.p_dec = p_dec;
                }
                
                // set tag to other if is an income or expense
                if ( product.get('expense_pdt') ) {
                    values.tag = "o";
                } else if ( product.get('income_pdt') ) {
                    values.tag = "i";
                }  else if ( values.tag ) {
                    values.tag = null;
                }
                
                // add line
                changedLine = self.lineStore.add(values)[0];
                if ( changedLine ) {
                    changedLine.dirty = true;
                }
            }
            
            // validate lines
            self.validateLines().then(function() {
                self.getOrderItemList().select(changedLine);
                //self.setDefaultItemMode(changedLine);
            });
            
            // show weight dialog
            if ( toWeight && changedLine && Config.hasScale() ) {
                if ( !self.scaleInput ) {
                    self.scaleInput = Ext.create('Fpos.view.ScaleView',{      
                        hideOnMaskTap: true,
                        modal: true,
                        centered : true                
                    });
                    Ext.Viewport.add( self.scaleInput );
                } else {
                    self.scaleInput.show();
                }
                
                // start scale
                self.scaleInput.setRecord(changedLine);
                self.scaleInput.startScale();
            }
        }
    },
    
    // save order
    onSaveOrder: function() {
        var self = this;
        if ( !self.isEditable() ) return;
         
        var place_id = self.order.get('place_id');
        var place = place_id ? self.placeStore.getPlaceById(place_id) : null;
        
        if ( place ) {
            place.set('amount',self.order.get('amount_total'));
            self.validateLines(true)['catch'](function(err) {
                ViewManager.handleError(err, {name:'Fehler', message:'Bestellung konnte nicht boniert werden'});
            }).then(function(){        
                Ext.Viewport.fireEvent("showPlace");
            });       
        }
    },
    
    round: function(val) {
        return Math.round(val*this.roundFactor) / this.roundFactor;  
    },
    
    // compute line values
    validateLine: function(line, taxes, taxlist) {
       var price, total, total_netto, netto;
       
       var self = this;
       
       var discount = line.get('discount') || 0.0;
       discount = 1.0 - (discount/100.0);
       
       var qty = line.get('qty') || 0.0;
       var tax_ids = line.get('tax_ids');

       if ( !taxes ) 
            taxes = {};
        
       var tax_percent = 0.0;
       var tax_fixed = 0.0;
       var total_tax = 0.0;
     
        
       Ext.each(tax_ids, function(tax_id) {
            var tax = taxes[tax_id];
            if ( !tax ) {
                var taxDef = self.taxStore.getById(tax_id);
                if ( taxDef ) {
                    var taxsum = {
                        fdoo__ir_model: 'fpos.order.tax',
                        tax_id : tax_id,                    
                        name : taxDef.get('name'), 
                        amount_tax : 0.0,
                        amount_netto : 0.0
                    };
                    
                    if (taxlist)
                        taxlist.push(taxsum);
                    
                    tax = {                    
                        type : taxDef.get('type'),
                        amount : taxDef.get('amount'),
                        sum : taxsum                    
                    };
                    taxes[tax_id] = tax;
                }
            }
            
            if ( tax ) {
                if (tax.type === 'percent') {
                    tax_percent += tax.amount;
                } else if (tax.type === 'fixed') {
                    tax_fixed += (tax.amount * qty);
                }                  
           }
        });
               
        // calc total
        netto = line.get('netto');
        price = line.get('price') || 0.0;
        if ( netto ) {
            total_netto =  qty * price * discount;
            total = self.round((total_netto+tax_fixed) * (1.0 + tax_percent));
        } else {     
            total = qty * price * discount;   
            total_netto = (total-tax_fixed) / (1.0 + tax_percent);
        }

        // sum tax
        Ext.each(tax_ids, function(tax_id) {
            var tax = taxes[tax_id];
            var amount_tax = 0.0;       
            if (tax.type === 'percent') {
                amount_tax = (total_netto * (1.0 + tax.amount)) - total_netto;
            } else if (tax.type === 'fixed') {
                amount_tax = (tax.amount * qty);
            }   
            
            // netto do rounding
            if ( netto ) {
                amount_tax = self.round(amount_tax);
            }
                
            tax.sum.amount_tax += amount_tax;
            tax.sum.amount_netto += total_netto;
            total_tax += amount_tax;
        });
        
        // set subtotal if dirty
        if ( line.get('subtotal_incl') != total ) {            
            line.set('subtotal_incl', total);
            line.set('subtotal', total_netto);
        }
        
        // return subtotal brutto and amount tax
        return { subtotal_incl: total, 
                 amount_tax:  total_tax };
    },
    
    // validate lines of current order
    validateLines: function(forceSave) {
        var self = this;
        var deferred = Ext.create('Ext.ux.Deferred');
        // primary check
        if ( self.order && self.order.get('state') === 'draft') {
                       
            var tax_group = {};
            var tax_ids = [];
            
            // compute lines
            var amount_netto = 0.0;
            var amount_total = 0.0;
            var amount_tax = 0.0;
            var turnover = 0.0;
            var lines = [];
            var updateLines = false;
            
            self.lineStore.each(function(line) {                
                var total_line = self.validateLine(line, tax_group, tax_ids);
                var tag = line.get('tag');
                if ( !tag ) {
                    // add                
                    amount_total += total_line.subtotal_incl;
                    amount_tax += total_line.amount_tax;
                    turnover += total_line.subtotal_incl;
                } else if ( tag == 'r' || tag == 'o' || tag == 'i') {
                    // add balance and other
                    amount_total += total_line.subtotal_incl;
                    amount_tax += total_line.amount_tax;
                } else if ( tag == 'b' ) {
                    // substract real balance
                    amount_total -= total_line.subtotal_incl;
                    amount_tax -= total_line.amount_tax;
                }                
                
                // add line                
                if ( line.dirty ) {
                    updateLines = true;
                    line.commit();
                }
                lines.push(line.getData());
            });
            
            // set values
            self.order.set('tax_ids', tax_ids);
            self.order.set('amount_tax', amount_tax);
            self.order.set('amount_total', amount_total);
            self.order.set('turnover', turnover);
            if ( updateLines ) {
                self.order.set('line_ids', lines);
            } else {
                // check if line count has changed
                var curLines = self.order.get('line_ids');
                if ( !curLines || curLines.length != lines.length ) {
                    self.order.set('line_ids', lines);
                }                               
            }
            
            // notify display update
            self.displayTask.delay(800);

            // save
            // ( only save if it is dirty, not places are active or force save was passed)            
            if ( self.order.dirty && (!Config.getProfile().iface_place || forceSave)) {
                self.order.save({
                    callback: function() {
                        deferred.resolve();
                    }
                });                
            } else {
                setTimeout(function() {
                    deferred.resolve();
                }, 0);
            }
            
        } else {
            setTimeout(function() {
                deferred.resolve();
            }, 0);
        }
        
        return deferred.promise();
    },
    
    // set current order
    setOrder: function(order) {
        var self = this;
        self.order = order;

        // reset of display
        // when new order (only in place mode)
        if ( Config.getProfile().iface_place ) {
            self.getPosDisplay().setRecord(null);
            self.getStateDisplay().setRecord(null);        
        }
        
        self.getPosDisplay().setRecord(order);
        self.getStateDisplay().setRecord(order);
        self.getOrderItemList().deselectAll(true);
        
        // get lines
        var lines = null;
        if ( order ) {
            lines = order.get('line_ids');
        }
        
        // update lines        
        if ( lines ) {
            self.lineStore.setData(lines);
        } else {
            self.lineStore.setData([]);
        }        
    },
    
    // create new order
    nextOrder: function() {
        var self = this;
        
        var db = Config.getDB();
        var user = Config.getUser();
        var profile = Config.getProfile();
                
        if ( user && profile) {
            var date = futil.datetimeToStr(new Date());  
            var values = {
                'fdoo__ir_model' : 'fpos.order',
                'fpos_user_id' : Config.getProfile().user_id,
                'user_id' : Config.getUser()._id,
                'state' : 'draft',
                'date' : date,
                'tax_ids' : [],
                'line_ids' : [],
                'amount_tax' : 0.0,
                'amount_total' : 0.0
            };
            
            if ( self.place ) {
                values.place_id = self.place.getId();
            }
            
            db.post(values).then(function(res) {                
                self.reloadData(true);
            });
        }
    },
    
    setMode: function(mode, sign) {    
        var self = this;    
        // set mode    
        self.mode = mode;
        
        // update text input
        this.inputText = '';        
        if (sign >= 0) {
            this.inputSign = 1; 
        } else if (sign < 0) {
            this.inputSign = -1;
        }
        
        // validate buttons
        Ext.each([self.getInputButtonAmount(),
                  self.getInputButtonDiscount(),
                  self.getInputButtonPrice()],
                 function(button) {
                    if ( button ) {
                        if ( button.getText() == self.mode ) {
                            button.setUi('posInputButtonGray');
                        } else {
                            button.setUi('posInputButtonBlack');
                        }
                    }                      
                 });        
    },   
    
    orderInputActiveItemChange: function(view, newCard) {
        var self = this;
        var paymentButton = self.getInputButtonPayment();
        if ( newCard == self.getPaymentPanel()  ) {
            if ( paymentButton ) {
                paymentButton.setUi('posInputButtonGray');
            }
            self.paymentEnabled = true;
        } else {
            if ( paymentButton ) { 
                paymentButton.setUi('posInputButtonOrange');
            }
            self.paymentEnabled = false;
        }
        self.setMode('*');
    },
      
    resetView: function() {
        // reset current view 
        var self = this;      
        var orderItemList = self.getOrderItemList();
        var inputView = self.getOrderInputView(); 
        if ( inputView.getActiveItem() != orderItemList ) {
            inputView.setActiveItem(orderItemList);
        }
    },
    
    fullDataReload: function() {
        var self = this;
        self.initialLoad = true;
        self.printTemplate = null;
        self.place = null;

        if ( Config.getProfile().iface_place ) {
           // load open orders
           var db = Config.getDB();           
           DBUtil.search(db, [['fdoo__ir_model','=','fpos.order'],['state','=','draft']], {'include_docs':true}).then(function(res) {
               Ext.each(res.rows, function(row) {
                  var place = self.placeStore.getPlaceById(row.doc.place_id);
                  if ( place ) {
                    place.set('amount',row.doc.amount_total);
                  } 
               });
               self.reloadData();
           });
        } else {       
          // default reload
          self.reloadData();
        }
    },
        
    reloadData: function(noCreateOrder) {
        if ( !this.initialLoad ) {
            this.fullDataReload();
        } else {
            var self = this;
            
            var db = Config.getDB();
            var user = Config.getUser();
            
            self.setMode('*');
            self.resetView();  
            
            // load if valid user and not places are activ or places are active 
            // and a valid place exist
            if ( user ) {
                var params = null;
                if ( self.place ) {
                    params =  {
                        domain : [['place_id','=',self.place.getId()],['state','=','draft']]
                    };
                } else {
                    params =  {
                        domain : [['user_id','=',user._id],['state','=','draft']]
                    };
                }
                        
                var options = {
                    params : params, 
                    callback: function() {
                        if ( self.orderStore.getCount() === 0 ) {
                            // create new order
                            if ( !noCreateOrder ) {
                                self.nextOrder();
                            }
                        } else {
                            // set current order                            
                            self.setOrder(self.orderStore.last());
                        }
                    }
                };
                self.orderStore.load(options);
            } else {
                // load nothing
                self.orderStore.setData([]);
                self.setOrder(null);
            }  
        }      
    },
    
    onUserChange: function(user) {
        if ( this.order && this.order.get('user_id') != user._id ) {
            this.reloadData();
        }
    },
    
    isEditable: function() {
        return this.order && this.order.get('state') == 'draft' && !this.paymentEnabled;
    },
    
    onInputCancelTap: function() {
        var self = this;
        self.inputText = '';    
        
        // default editing
        if ( self.isEditable() ) {
            var records = self.getOrderItemList().getSelection();
            if ( records.length > 0  ) {
                var record = records[0];
                var tag = record.get("tag");
                if ( !tag || tag == 'o' ||  tag == 'i' || tag == 'r') {
                    // reset price price
                    if ( self.mode == "€" ) {
                        var db = Config.getDB();
                        var product_id = record.get('product_id');
                        if ( product_id ) {
                            db.get(product_id).then(function(doc) {
                                // delete or reset price
                                if ( record.get('price') === doc.price) {
                                   self.lineStore.remove(record);
                                } else {
                                   record.set('price',doc.price);
                                }
                                self.validateLines();   
                            })['catch'](function(err) {
                                ViewManager.handleError(err, {name:'Fehler', error: 'Produkt kann nicht zurückgesetzt werden'});
                            });              
                        } else {
                            record.set('price',0.0);
                            self.validateLines();       
                        }
                    } else {
                        // reset quantity
                        if ( self.mode == "*") {
                            if ( record.get('qty') === 0.0 ) {
                                if ( !tag || tag != 'r' ) {
                                    self.lineStore.remove(record);
                                } else {
                                    record.set('qty',1.0);
                                }
                            } else {
                                if ( tag == 'o' || tag == 'i' || tag == 'r' ) {
                                    record.set('qty',1.0);
                                } else {
                                    record.set('qty',0.0);
                                }
                            }
                        // reset discount
                        } else if ( self.mode == "%") {
                            record.set('discount',0.0);
                        }                         
                        self.validateLines();
                    }
                }                
            } 
        } else if ( self.paymentEnabled ) {
            // handle payment
            var payments = self.getPaymentItemList().getSelection();
            if ( payments.length > 0  ) {            
               var payment = payments[0];
               payment.set('payment',0.0);
               self.validatePayment();
            }
        }
    },
    
    getInputTextFromLine: function(line) {
        if ( this.mode == "%") {
            return futil.formatFloat(line.get('discount'), Config.getDecimals());
        } else if ( this.mode == "€") {
            return futil.formatFloat(line.get('price'), Config.getDecimals());
        } else {
            return futil.formatFloat(line.get('qty'), Config.getQtyDecimals());
        }
    },
        
    inputAction: function(action) {
        var valid = true;   
        var commaPos, decimals, value;
        if ( this.isEditable() ) {
            
            var lines = this.getOrderItemList().getSelection();
            if ( lines.length > 0  ) {            
                var line = lines[0];
                var tag = line.get('tag');    
                  
                var a_pre = line.get('a_pre');
                var a_dec = line.get('a_dec');
                var p_pre = line.get('p_pre');
                var p_dec = line.get('p_dec');
                var flags = line.get('flags');

                var max_a_dec = Config.getQtyDecimals();
                if ( a_dec < 0 || a_dec > 0) {
                    max_a_dec = Math.min(a_dec, max_a_dec);
                }
                
                var max_p_dec = Config.getDecimals();
                if ( p_dec < 0 || p_dec > 0) {
                    max_p_dec = Math.min(p_dec, max_p_dec);
                }
                
                var nounit = false;
                var minus = false;
                if (flags) {
                    minus = flags.indexOf('-') > -1;
                    nounit = flags.indexOf('u') > -1;
                }
                       
                if ( !tag || tag == 'r' || tag == 'o' || tag == 'i') {
                
                    // set mode to €
                    // if it is real balance input
                    // if it is other
                    if ( tag == 'r' || tag == 'o' || tag == 'i' || nounit) {
                        if ( this.mode != '€' ) {
                            this.setMode('€');
                        }
                        // check input sign
                        if ( ( tag == 'o' || (minus && this.inputText.length === 0) ) && this.inputSign !== -1 ) {
                            this.inputSign = -1;
                        }
                    }
                    
                    // switch sign
                    if ( action == "+/-" ) {
                        if ( this.mode == "*"  || this.mode == "€") {
                            // special case, only switch sign
                            if ( this.inputText.length === 0 ) {
                                if ( this.mode == "*" ) {
                                    line.set('qty',line.get('qty')*-1);
                                } else {
                                    line.set('price',line.get('price')*-1);
                                }
                                this.validateLines();
                                valid = false;
                            } else {
                                this.inputSign*=-1;
                            }
                        } else {
                            valid = false;
                        }
                    // add comma
                    } else if ( action == "." ) {
                        if ( this.mode == '*' && a_dec < 0 ) {
                            valid = false;
                        } else if ( this.mode == '€' && p_dec < 0) {
                            valid = false;
                        } else if ( this.inputText.indexOf(".") < 0 ) {                            
                            this.inputText += "."; 
                        } else {
                            valid = false;
                        }
                    // default number handling
                    } else {
                        commaPos = this.inputText.indexOf(".");
                        if ( commaPos >= 0 ) { 
                            decimals = this.inputText.length - commaPos; 
                            if ( this.mode == '*' ) {
                                // only add if less than max qty decimals
                                if ( decimals > max_a_dec ) {
                                    valid = false;
                                }
                            // only add if less than max decimals
                            } else if ( this.mode == '€' ) {
                                // only add if less than max price decimals
                                if ( decimals > max_p_dec ) {
                                    valid = false;
                                }
                            // default check decimals
                            } else if ( decimals > Config.getDecimals() )  {
                                valid = false;
                            }
                        } else {
                            // fixed comma
                            if ( this.mode == '*' ) {
                               if ( a_pre < 0 || (a_pre > 0 && this.inputText.length == a_pre) ) {
                                 this.inputText += ".";
                               } 
                            } else if ( this.mode == '€' ) {
                               if ( p_pre < 0 || (p_pre > 0 && this.inputText.length == p_pre ) ) {
                                 this.inputText += ".";
                               }
                            }
                        }
                                                                        
                        //add if valid
                        if ( valid ) {
                            this.inputText += action;                            
                        }            
                    }
                  
                    // update if valid
                    if ( valid ) {
                        // update
                        value = parseFloat(this.inputText);
                        if ( this.mode == "€" ) {
                            line.set('price', value*this.inputSign);
                        } else if ( this.mode == "%" ) {
                            line.set('discount', value);
                        } else {
                            line.set('qty', value*this.inputSign);
                        }
                        this.validateLines();
                    }
                }
            }
            
        }  else if ( this.paymentEnabled ) {
            var payments = this.getPaymentItemList().getSelection();
            if ( payments.length > 0  ) {            
                var payment = payments[0];
                
                // switch sign
                if ( action == "+/-" ) {
                    if ( this.inputText.length === 0 ) {
                        payment.set('payment',payment.get('payment')*-1);
                        this.validatePayment();
                        valid = false;
                    } else {
                        this.inputSign*=-1;
                    }
                // add comma
                } else if ( action == "." ) {
                    if ( this.inputText.indexOf(".") < 0 ) {
                        this.inputText += "."; 
                    } else {
                        valid = false;
                    }
                // default number handling
                } else {
                    commaPos = this.inputText.indexOf(".");
                    if ( commaPos >= 0 ) { 
                        decimals = this.inputText.length - commaPos; 
                        if ( decimals > Config.getDecimals() ) {
                            valid = false;
                        }                        
                    }                    
                    //add if valid
                    if ( valid ) 
                        this.inputText += action;            
                }
              
                // update if valid
                if ( valid ) {
                    // update
                    value = parseFloat(this.inputText);
                    payment.set('payment', value*this.inputSign);
                    this.validatePayment();
                }
            }
        }
    },
    
    onInputModeSwitch: function(button) {
        this.setMode(button.getText(), 1);
    },
    
    onInputNumber: function(button) {
        this.inputAction(button.getText());
    },
    
    setDefaultItemMode: function(line) {
        if ( !line ) {
            var lines = this.getOrderItemList().getSelection();
            if ( lines.length > 0  ) {
                line = lines[0];
            }
        }
        if ( line  ) {
            var flags = line.get('flags');
            var sign = flags && flags.indexOf('-') > -1 ? -1 : 1;
            var tag = line.get('tag');            
            if ( tag == 'r' || tag == 'o' || tag == 'i' || ( flags && (flags.indexOf('u') > -1 || flags.indexOf('p') > -1) ) ) {
                var price = line.get('price');              
                if ( price < 0 ) {
                    sign = -1;
                } else if ( price > 0) {
                    sign = 1;
                }
                this.setMode('€', sign);                
            } else {
                var qty = line.get('qty');
                if ( qty < 0 ) {
                    sign = -1;                    
                } else if (qty > 0) {
                    sign = 1;                   
                }
                this.setMode('*', sign);
            }
        } else {
            this.setMode('*');    
        }
    },
    
    setDefaultPaymentMode: function() {
        var total = this.order.get('amount_total');
        if ( total < 0 ) {
            this.setMode('*',-1);
        } else {
            this.setMode('*');
        }
    },
    
    onItemSelectionChange: function() {
       this.setDefaultItemMode();
    },
    
    onPaymentSelectionChange: function() {
        var self = this;
        var payments = this.getPaymentItemList().getSelection();
        if ( payments.length > 0  ) {            
            var payment = payments[0];
            var journal = payment.get('journal');
            
            // get total and amounts
            var total = self.order.get('amount_total');
            var orderPayments = self.order.get('payment_ids');
            var fullPaymentJournalId = null;
            var otherPayment = 0.0;
            Ext.each(orderPayments, function(orderPayment) {
                if ( orderPayment.journal_id != journal._id ) {
                    otherPayment += orderPayment.payment;
                    // check full payment
                    if ( orderPayment.amount == total ) {
                        fullPaymentJournalId = orderPayment.journal_id;
                    }
                }
                
            });
                        
            // search full payment data
            var fullPayment = null;
            if ( fullPaymentJournalId ) {
                self.paymentStore.each(function(data) {                    
                    if ( data.get('journal')._id == fullPaymentJournalId ) {
                        fullPayment = data; 
                        return false;
                    }
                });
            }
            
            // set total amount to other payment method
            if ( fullPayment ) {
                payment.set("payment", total);
                fullPayment.set("payment", 0.0);
                self.validatePayment();
            // check if there is an rest
            } else if ( otherPayment < total ) {
                payment.set("payment", total-otherPayment);
                self.validatePayment();
            }
        }
        self.setDefaultPaymentMode();
    },
    
    onEditOrder: function() {
        var self = this;
        if ( self.order && !futil.isDoubleTap() ) {
            var lines = self.getOrderItemList().getSelection();
            var form;
            if ( lines.length > 0 ) {
                form = Ext.create("Fpos.view.OrderLineFormView", {'title' : 'Position'});
                form.setRecord(lines[0]);
            } else {
                form =  Ext.create("Fpos.view.OrderFormView", {'title' : 'Verkauf'});
                form.setRecord(this.order);
            }
            
            if ( form ) {
                if ( self.order.get('state') != 'draft') 
                    form.setDisabled(true);                
                Ext.Viewport.fireEvent("showForm", form); 
            }
        }
    },
    
    postOrder: function() {
        var self = this;
        
        if ( !self.order ) {
            throw  {
                name: "Buchungsfehler",
                message: "Kein Verkauf ausgewählt"
            };
        }
        
        var deferred = Ext.create('Ext.ux.Deferred');
        var db = Config.getDB();
        var profile = Config.getProfile();
        var hasSeq = false;
        
        self.validateLines(true)['catch'](function(err) {
            deferred.reject(err);
        }).then(function(){
            
            // write order
            var writeOrder = function(seq, turnover, cpos) {
                // init vars
                if ( !cpos ) cpos = 0.0;
                if ( !turnover ) turnover = 0.0; 
                var cashJournalId = Config.getCashJournal()._id;
                
                // add cash payment if no payment
                var payment_ids = self.order.get('payment_ids');                
                if ( !payment_ids || payment_ids.length === 0 ) {
                    var amount_total = self.order.get('amount_total');
                    payment_ids = [
                        {
                            journal_id : cashJournalId,
                            amount : amount_total,
                            payment : amount_total                     
                        }
                    ];
                    self.order.set('payment_ids',payment_ids);
                }
                
                // determine cpos     
                var fixed_payments = [];         
                Ext.each(payment_ids, function(payment) {
                    if ( payment.journal_id == cashJournalId ) {
                        cpos += payment.amount;
                        fixed_payments.push(payment);
                    } else if ( payment.amount !== 0 || payment.payment !== 0) {
                        fixed_payments.push(payment);
                    }
                });
                
                // write order                
                var date = futil.datetimeToStr(new Date());
                self.order.set('payment_ids',fixed_payments);
                self.order.set('date', date);
                self.order.set('seq', seq);
                self.order.set('name', Config.formatSeq(seq));
                self.order.set('state','paid');
                
                // turnover
                self.order.set('turnover',self.order.get('turnover')+turnover);
                // cpos
                self.order.set('cpos', cpos);
                
                // save
                self.order.save({
                    callback: function() {
                        deferred.resolve();           
                    }
                });
            };
            
            // query last order
            try {
                Config.queryLastOrder()['catch'](function(err) {
                    deferred.reject(err);
                }).then(function(res) {
                    // write order
                    if ( res.rows.length === 0 ) {
                        writeOrder(profile.last_seq+1, profile.last_turnover, profile.last_cpos);
                    } else {
                        var lastOrder = res.rows[0].doc;
                        writeOrder(lastOrder.seq+1, lastOrder.turnover, lastOrder.cpos);
                    }
                });
            } catch (err) {
                deferred.reject(err);
            }
        });    
        return deferred.promise();      
    },
    
    onCash: function() {
        var self = this;
        if ( self.isEditable() || (self.paymentEnabled && self.validatePayment()) ) {
            //self.printOrder();
            // add payment
            // and print
            self.postOrder()['catch'](function(err) {
                ViewManager.handleError(err,{
                    name: "Buchungsfehler",
                    message: "Verkauf konnte nicht gebucht werden"
                }, true);
            }).then(function() {
                self.printOrder();
                if ( Config.getProfile().iface_place ) {
                    var place_id = self.order.get('place_id');
                    var place = place_id ? self.placeStore.getPlaceById(place_id) : null;        
                    if ( place ) {
                      place.set('amount',0);
                    }
                    Ext.Viewport.fireEvent("showPlace");
                } else {
                    self.reloadData();
                }
            });
        } else {
            // if not editable
            // reload data
            self.reloadData();
        }          
    },
    
    printOrder: function(order) {
        var self = this;        
        if ( !self.printTemplate ) {
            var profile = Config.getProfile();
            self.printTemplate = Ext.create('Ext.XTemplate',
                profile.receipt_header || '',
                '<table width="100%">',
                    '<tr>',
                        '<td colspan="2"><hr/></td>',
                    '</tr>',
                    '<tr>',
                        '<td width="{attribWidth}">Beleg:</td>',
                        '<td>{o.name}</td>',
                    '</tr>',
                    '<tr>',
                        '<td width="{attribWidth}">Datum:</td>',
                        '<td>{date:date("d.m.Y H:i:s")}</td>',
                    '</tr>',
                    '<tr>',
                        '<td width="{attribWidth}">Kasse:</td>',
                        '<td>{[Config.getProfile().name]}</td>',
                    '</tr>',
                    '<tr>',
                        '<td width="{attribWidth}">Bediener:</td>',
                        '<td>{[Config.getUser().name]}</td>',
                    '</tr>',
                    '<tpl if="o.ref">',
                    '<tr>',
                        '<td width="{attribWidth}">Referenz:</td>',
                        '<td>{o.ref}</td>',
                    '</tr>',
                    '</tpl>',
                '</table>',
                '<tpl if="o.partner">',
                '<table width="100%">',
                    '<tr>',
                        '<td><hr/></td>',
                    '</tr>',
                    '<tr>',
                        '<td>K U N D E</td>',
                    '</tr>',
                    '<tr>',
                        '<td><hr/></td>',
                    '</tr>',
                    '<tr>',
                        '<td>',
                            '{o.partner.name}',
                            '<tpl if="o.partner.street"><br/>{o.partner.street}</tpl>',
                            '<tpl if="o.partner.street2"><br/>{o.partner.street2}</tpl>',
                            '<tpl if="o.partner.zip && o.partner.city"><br/>{o.partner.zip} {o.partner.city}</tpl>',
                        '</td>',
                    '</tr>',
                '</table>',
                '</tpl>',
                '<br/>',
                '<table width="100%">',
                '<tr>',
                    '<td>Bezeichnung</td>',
                    '<td align="right" width="{priceColWidth}">Betrag {[Config.getCurrency()]}</td>',
                '</tr>',
                '<tr>',                
                    '<td colspan="2"><hr/></td>',
                '</tr>',
                '<tpl for="lines">',
                    '<tpl if="this.hasTag(values,\'c\')">',
                        '<tr>',
                            '<td colspan="2">{name}</td>',                        
                        '</tr>',
                        '<tr>',
                            '<td colspan="2">{[futil.formatFloat(values.subtotal_incl,Config.getDecimals())]} {[Config.getCurrency()]}</td>',
                        '</tr>',
                        '<tr>',                
                            '<td colspan="2"><hr/></td>',
                        '</tr>',
                    '<tpl else>',
                        '<tr>',
                            '<td>{name}</td>',
                            '<td align="right" width="{priceColWidth}">{[futil.formatFloat(values.subtotal_incl,Config.getDecimals())]}</td>',
                        '</tr>',
                        '<tpl if="(!this.hasTag(values) && !this.hasFlag(values,\'u\')) || this.hasFlag(values,\'d\')">',
                            '<tr>',
                                '<td colspan="2">',
                                    '<table width="100%">',
                                    '<tr>',
                                    '<td width="5%">&nbsp;</td>',
                                    '<td>',
                                        '{[this.formatAmount(values)]} {[this.getUnit(values.uom_id)]}',
                                        '<tpl if="values.qty != 1.0"> * {[futil.formatFloat(values.price,Config.getDecimals())]} {[Config.getCurrency()]}</tpl>', 
                                        '<tpl if="discount"> -{[futil.formatFloat(values.discount,Config.getDecimals())]}%</tpl>',
                                    '</td>',
                                    '</tr>',
                                    '</table>',
                                '</td>',        
                            '</tr>',
                        '</tpl>',
                    '</tpl>',
                    '<tpl if="notice">',
                    '<tr>',
                        '<td colspan="2">',
                            '<table width="100%">',
                                '<tr>',
                                    '<td width="5%">&nbsp;</td>',
                                    '<td>{[this.formatText(values.notice)]}</td>',
                                '</tr>',
                            '</table>',
                        '</td>',
                    '</tr>',
                    '</tpl>',
                    '<tpl if="this.hasFlag(values,\'b\')">',
                        '<tr>',                
                            '<td colspan="2"><hr/></td>',
                        '</tr>',
                    '</tpl>',
                '</tpl>',
                '<tr>',                
                    '<td colspan="2"><hr/></td>',
                '</tr>',
                '<tr>',
                    '<td align="right"><b>S U M M E</b></td>',
                    '<td align="right" width="{priceColWidth}"><b>{[futil.formatFloat(values.o.amount_total,Config.getDecimals())]}</b></td>',        
                '</tr>',
                '<tpl for="o.payment_ids">',
                '<tr>',
                    '<td align="right">{[this.getJournal(values.journal_id)]}</td>',
                    '<td align="right" width="{priceColWidth}">{[futil.formatFloat(values.amount,Config.getDecimals())]}</td>',        
                '</tr>',
                '</tpl>',                
                '</table>',                                
                '<tpl if="o.tax_ids && o.tax_ids.length &gt; 0">',
                    '<br/>',
                    '<table width="100%">',                    
                    '<tr>',
                        '<td width="70%">Steuer</td>',
                        '<td align="right" width="30%">Netto {[Config.getCurrency()]}</td>',
                    '</tr>',
                    '<tr>',                
                        '<td colspan="2"><hr/></td>',
                    '</tr>',
                    '<tpl for="o.tax_ids">',
                    '<tr>',
                        '<td width="70%">{name} {[futil.formatFloat(values.amount_tax,Config.getDecimals())]} {[Config.getCurrency()]}</td>',
                        '<td align="right" width="30%">{[futil.formatFloat(values.amount_netto,Config.getDecimals())]}</td>',        
                    '</tr>',
                    '</tpl>',
                    '</table>',
				'</tpl>',                
                profile.receipt_footer || '',
                {
                    getUnit: function(uom_id) {
                        var uom = self.unitStore.getById(uom_id);
                        return uom ? uom.get('name') : '';
                    },
                    getJournal: function(journal_id) {
                        var journal = Config.getJournal(journal_id);
                        return journal ? journal.name : '';
                    },
                    formatText: function(text) {
                        return text ? text.replace(/\n/g,'<br/>') : '';
                    },
                    formatAmount: function(values)  {
                        var dec = values.a_dec;
                        if ( dec < 0 ) {
                            return futil.formatFloat(values.qty, 0);
                        } else if ( dec > 0 ) {
                            return futil.formatFloat(values.qty, dec);
                        } else {
                            return futil.formatFloat(values.qty, Config.getQtyDecimals()); 
                        }
                    },
                    hasTag: function(values, tag) {
                        if ( !tag ) {
                            return values.tag ? true : false;
                        } else if ( !values.tag ) {
                            return false;
                        } else {
                            return values.tag == tag;
                        }
                    },
                    hasFlag: function(values, flag) {
                        if ( !flag) {
                            return values.flags ? true : false;
                        } else if ( !values.flags ) {
                            return false;
                        } else {
                            return values.flags.indexOf(flag) > -1;
                        }
                    }
                }                
            );
        }

        // get order if not passed
        if (!order) {
            order = this.order.getData();
        }
        
        // data
        var data = {
            o: order,
            lines : order.line_ids,
            priceColWidth: "32%",
            attribWidth: "34%",
            date: futil.strToDate(this.order.get('date'))
        };
        
        // render it
        var html = self.printTemplate.apply(data);
        // print/show it
        if ( !Config.hasPrinter() ) { 
            html = '<div class="PrintReport">' + html + '</div>';       
            if ( !self.reportPanel ) {
                self.reportPanel = Ext.create('Ext.Panel',{
                    hideOnMaskTap: true,
                    modal: true,
                    centered: true,
                    scrollable: true,
                    cls: 'PrintReport',
                    height: '400px',
                    width: '300px',
                    layout: 'vbox',
                    html: html 
                });                
                Ext.Viewport.add(self.reportPanel);
            } else {
                self.reportPanel.setHtml(html);
                self.reportPanel.show();
            }
        } else {
            Config.printHtml(html);
        }
       
        // open cash drawer
        Config.openCashDrawer();
    },
    
    display: function() {
        var amount_total = this.order ? this.order.get('amount_total') : null;
        if ( amount_total ) {
            Config.display(amount_total.toFixed(2));
        } else {
            Config.display("0.00");
        }
    },
    
    validatePayment: function() {
        var self = this;
        if ( !self.summaryTemplate ) {
            self.summaryTemplate = Ext.create('Ext.XTemplate',
                '<div class="PaymentItem">',
                '<div class="PaymentName">',
                    'Bezahlt',
                '</div>',
                '<div class="PaymentValue">',
                    '{[futil.formatFloat(values.payment)]}',
                '</div>',
                '</div>',
                '<div class="PaymentItem">',
                '<div class="PaymentName">',
                    'Restbetrag',
                '</div>',
                '<div class="PaymentValue">',
                    '{[futil.formatFloat(values.rest)]}',
                '</div>',
                '</div>',
                '<div class="PaymentChangeItem">',
                '<div class="PaymentName">',
                    'Wechelgeld',
                '</div>',
                '<div class="PaymentValue">',
                    '{[futil.formatFloat(values.change)]}',
                '</div>',
                '</div>',
                '</div>');
        }
        
        var payment_ids = [];
        
        // calc
        var change = 0.0;
        var total = self.order.get('amount_total');
        var rest = total;
        self.paymentStore.each(function(data) {
            var payment = data.get('payment');
            var journal = data.get('journal');
            var curRest = rest;
            
            //calc
            if ( payment >= rest && total >= 0 ) {
                change += (payment-rest);
                rest = 0;
            } else {
                rest -= payment;
            }
            
            // add payment
            payment_ids.push({
                journal_id : journal._id,
                amount : curRest - rest,
                payment : payment
            });
        });
        
        // update label
        var html = self.summaryTemplate.apply({
            change : change,
            rest : rest,
            payment : total - rest            
        });
        self.getPaymentSummary().setHtml(html);
        
        // set payment
        self.order.set('payment_ids', payment_ids);
        // check if it is valid
        return rest === 0;
    },
    
    onPayment: function() {
        var self = this;
        var inputView = self.getOrderInputView();
        if ( inputView.getActiveItem() != self.getPaymentPanel() ) {
            
            // init payment
            var amount_total = self.order.get('amount_total');
            var profile = Config.getProfile();
            
            // first payment line is cash line
            var payment = [{
                journal : Config.getCashJournal(),
                amount : amount_total,
                payment : amount_total
            }];
            // process other
            Ext.each(profile.journal_ids, function(journal) {
                if ( journal.type !== 'cash' ) {
                    payment.push({
                       journal : journal,
                       amount : 0.0,
                       payment: 0.0
                    });
                }
            });
            
            // set initial payment
            self.paymentStore.setData(payment); 
            self.validatePayment();
            self.getPaymentItemList().selectRange(0,0,false);
            
            // view payment
            inputView.setActiveItem(self.getPaymentPanel());
            
        } else {
            inputView.setActiveItem(self.getOrderItemList());
        }
    },
    
    createCashState: function() {
        var self = this;

        // reset place
        self.place = null;
        
        var db = Config.getDB();
        var profile = Config.getProfile();
        var user_id = Config.getUser()._id;
        var fpos_user_id = profile.user_id;
        
        var turnover = profile.last_turnover;
        var cpos = profile.last_cpos;
        var date = futil.datetimeToStr(new Date());
        var order_id;
      
        if ( user_id && fpos_user_id) {
            ViewManager.startLoading("Kassenstand erstellen");

            DBUtil.search(db, [['fdoo__ir_model','=','fpos.order'],['state','=','draft']], {include_docs: true}).then(function(res) {
               var bulkUpdate = [];
               Ext.each(res.rows, function(row) {
                     row.doc._deleted = true;
                     bulkUpdate.push(row.doc);
               });
               return db.bulkDocs(bulkUpdate);
            }).then(function(res) {
                return Config.queryLastOrder().then(function(res) {
                        if ( res.rows.length > 0 ) {
                            var lastOrder = res.rows[0].doc;
                            turnover = lastOrder.turnover;
                            cpos = lastOrder.cpos;
                        } 
                        return db.post({
                                'fdoo__ir_model' : 'fpos.order',
                                'fpos_user_id' : fpos_user_id,
                                'user_id' : user_id,
                                'state' : 'draft',
                                'date' : date,
                                'tax_ids' : [],
                                'line_ids' : [
                                    {
                                        // TURNOVER
                                        'name' : 'Umsatzzähler',
                                        'price' : turnover,
                                        'qty' : 1.0,
                                        'subtotal_incl' : turnover,
                                        'discount' : 0.0,
                                        'sequence' : 0,
                                        'tag' : 'c'
                                    },
                                    {
                                        // BALANCE
                                        'name' : 'Kassenstand SOLL',
                                        'price' : cpos,
                                        'qty' : 1.0,
                                        'subtotal_incl' : cpos,
                                        'discount' : 0.0,
                                        'sequence' : 1,
                                        'tag' : 'b'
                                    }, 
                                    {
                                        // SHOULD
                                        'name' : 'Kassenstand IST',
                                        'price' : cpos,
                                        'qty' : 1.0,
                                        'subtotal_incl' : cpos,
                                        'discount' : 0.0,
                                        'sequence' : 2,
                                        'tag' : 'r'
                                    }
                                    
                                ],
                                'amount_tax' : 0.0,
                                'amount_total' : 0.0,
                                'tag' : 's' // CASH STATE
                        })['catch'](function(err) {          
                           ViewManager.stopLoading();
                           ViewManager.handleError(err,{
                                name: "Kassensturz Fehler",
                                message: "Kassensturz konnte nicht erstellt werden"
                           });
                        }).then(function(res) {
                            ViewManager.stopLoading();                            
                            self.reloadData();
                        });
                    });
            })['catch'](function(err) {          
               ViewManager.stopLoading();
               ViewManager.handleError(err,{
                    name: "Kassensturz Fehler",
                    message: "Kassensturz konnte nicht erstellt werden"
               });
            });
        }
        
    },
    
    createCashOverview: function(user) {
        var self = this;
        var db = Config.getDB();
        var profile = Config.getProfile();
        var user_id = Config.getUser()._id;
        var fpos_user_id = profile.user_id;
        var date = futil.datetimeToStr(new Date());
      
        if ( user_id && fpos_user_id) {
        
            Config.queryOrders().then(function(orders) {
                if ( orders.length === 0 )
                    return;
                
                var overview = {};
                var positions = [];
                var taxes = {};
                var taxNames = [];
                var lines = [];
                var total = 0.0;
                var seq = 1;
                
                Ext.each(orders, function(order) {
                    if ( !order.tag && (!user || order.user_id == user._id) ) {
                        // positions
                        Ext.each(order.line_ids, function(line) {
                            if ( !line.tag ) {
                                // build summary
                                var summary = overview[line.name];
                                total += line.subtotal_incl;
                                if (!summary) {
                                    summary = {
                                        tag: 's',
                                        name: line.name,
                                        price: line.price,                                
                                        qty : line.qty,
                                        uom_id: line.uom_id,
                                        subtotal_incl: line.subtotal_incl,
                                        sequence : 0,
                                        discount: 0.0
                                    };
                                    overview[line.name] = summary;
                                    positions.push(line.name);
                                } else {
                                    summary.subtotal_incl +=  line.subtotal_incl;
                                    summary.qty += line.qty;
                                }
                            }
                        });
                        
                        //taxes
                        Ext.each(order.tax_ids, function(tax) {
                            var summary = taxes[tax.name];
                            if (!summary) {
                                summary = {     
                                    tag: 's',
                                    name: tax.name,
                                    qty: 1.0,
                                    price: tax.amount_tax,  
                                    subtotal_incl : tax.amount_tax,
                                    sequence : 0,
                                    discount: 0.0
                                };
                                taxes[tax.name] = summary;
                                taxNames.push(tax.name);
                            } else {
                                summary.subtotal_incl += tax.amount_tax;
                                summary.price = summary.subtotal_incl;
                            }
                        });
                    }              
                });
                
                
                // HEADER
                
                var header = 'Verkäufe Gesamt';
                if ( user ) {
                    header = 'Verkäufe ' + user.name;
                }
                lines.push({
                    name : header,
                    price : total,
                    qty : 1.0,
                    subtotal_incl : total,
                    discount : 0.0,
                    sequence : 0,
                    tag : 's',
                    flags: 'b'
                });
                
                // PRODUCTS
                
                positions.sort();
                var lastIndex = positions.length-1;
                Ext.each(positions, function(pos, index)  {
                    var summary = overview[pos];
                    lines.push(summary);
                    
                    summary.flags = 'd';
                    if ( index == lastIndex ) {
                        summary.flags += 'b';
                    }
                    
                    summary.sequence = seq;
                    seq+=1;               
                });
                
                // TAXES
               
                taxNames.sort();
                Ext.each(taxNames, function(taxName, index) {                    
                    var summary = taxes[taxName];
                    lines.push(summary);
                    summary.sequence = seq;
                    seq+=1;  
                } );
                
                
                //CREATE
                return db.post({
                    'fdoo__ir_model' : 'fpos.order',
                    'fpos_user_id' : fpos_user_id,
                    'user_id' : user_id,
                    'state' : 'draft',
                    'date' : date,
                    'tax_ids' : [],
                    'line_ids' : lines,
                    'amount_tax' : 0.0,
                    'amount_total' : 0.0,
                })['catch'](function(err) {          
                  ViewManager.stopLoading();
                  ViewManager.handleError(err,{
                        name: "Verkaufsübersicht Fehler",
                        message: "Verkaufsübersicht konnte nicht erstellt werden"
                   });
                }).then(function(res) {
                    ViewManager.stopLoading();                            
                    self.reloadData();
                });
                
            })['catch'](function(err) {
               ViewManager.stopLoading();
               ViewManager.handleError(err,{
                    name: "Verkaufsübersicht Fehler",
                    message: "Verkaufsübersicht konnte nicht erstellt werden"
               });
            });
        
        }
            
    },
    
    onCreateCashState: function() {
        if ( !futil.isDoubleTap() ) {
            ViewManager.hideMenus();
            this.createCashState();
        }
    },
    
    onCashOverview: function() {
        if ( !futil.isDoubleTap() ) {
            ViewManager.hideMenus();
            var profile = Config.getProfile();
            var self = this;
            if ( profile ) {
                if ( profile.user_ids.length <= 1) {
                    this.createCashOverview(null);
                } else {
                    Ext.Msg.show({
                        title: 'Verkaufsübersicht',
                        message: 'Verkaufsübersicht Gesamt oder für den aktuellen Verkäufer erstellen?',
                        buttons: [{
                                text: 'Gesamt'
                            
                            },
                            {
                                text: 'Verkäufer'
                            }
                        ],
                        fn: function(buttonId) {
                            if ( buttonId === 'Gesamt' ) {          
                                self.createCashOverview(null);
                            } else {
                                self.createCashOverview(Config.getUser());
                            }
                        }
                    });                   
                }
            }
        }
    },
    
    onPrintAgain: function() {
        var self = this;
        if ( !futil.isDoubleTap() ) {
            ViewManager.hideMenus();
            var db = Config.getDB();
            Config.queryLastOrder().then(function(res) {
                if ( res.rows.length > 0 ) {
                    var order = res.rows[0].doc;
                    if ( order.partner_id ) {
                        db.get(order.partner_id).then(function(partner) {
                            order.partner = partner;
                            self.printOrder(order);
                        })['catch'](function(err) {
                            self.printOrder(order);
                        });
                    } else {
                        self.printOrder(order);
                    }
                }
             });
        }
    },
    
    onKeyDown: function(e) {
        var keycode = e.keyCode ? e.keyCode : e.which;
        if ( keycode >= 48 && keycode <= 57 ) {            
            var c = String.fromCharCode(keycode);
            this.inputAction(c);
        } else if ( keycode == 13 ) {
            this.onCash();
        } else if ( keycode == 27 ) {
            this.onInputCancelTap();
        } else if ( keycode === 0 ) {
            this.onEditOrder();
        } else if ( keycode == 190 ) {
            this.inputAction('.');
        } else if ( keycode == 8) {
            // only react if nothing is selected
            if ( e.currentTarget && e.currentTarget.activeElement && e.currentTarget.activeElement.localName == 'body' ) {
                this.onPayment();
            }
        }
    }
    
});
    