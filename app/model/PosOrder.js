/*global Ext:false, Config:false*/
Ext.define('Fpos.model.PosOrder', {
   extend: 'Ext.data.Model',
   requires: [
       'Ext.proxy.PouchDB'
   ],
   config: {
       fields: ['fpos_user_id',
                'user_id',
                'partner_id', 
                'date',
                'seq',
                'name',
                'ref',                
                'tax_ids',
                'payment_ids',
                'state',                
                'note',                
                'send_invoice',
                'amount_tax',
                'amount_total',
                {name:'partner', foreignKey: 'partner_id', resModel: 'res.partner', persist:false}],
       identifier: 'uuid',
       proxy: {
            type: 'pouchdb',
            database: 'fpos',
            resModel: 'fpos.order'
       }
   }
});