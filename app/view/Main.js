/*global Ext:false, DBUtil:false, PouchDB:false, openerplib:false, futil:false, Fpos:false, Config:false*/
Ext.define('Fpos.view.Main', {
    extend: 'Ext.navigation.View',
    xtype: 'main',   
    id: 'mainView', 
    requires: [
        
    ],
    config: {
        layout: {
            type: 'card',
            animation: false
        },
        navigationBar: {
            items: [
                {
                    xtype: 'button',
                    id: 'loginButton',
                    text: 'Anmelden',                                  
                    align: 'left',
                    action: 'switchUser',
                    hidden: true                
                },       
                {
                    xtype: 'button',
                    id: 'placeButton',
                    text: 'Plätze',
                    align: 'left',
                    action: 'switchPlace',
                    ui: 'back',
                    hidden: true                    
                },
                {
                    xtype: 'button',
                    iconCls: 'list',
                    id: 'mainMenuButton',
                    ui: 'plain',
                    align: 'right',
                    hidden: true
                },
                {
                    xtype: 'button',
                    id: 'saveOrderButton',
                    iconCls: 'action',       
                    ui: 'plain',                    
                    align: 'right',
                    action: 'saveOrder',
                    hidden: true                
                },   
                {
                    xtype: 'button',
                    id: 'deleteRecordButton',
                    iconCls: 'trash',
                    align: 'right',
                    action: 'deleteRecord',  
                    hidden: true
                },                 
                {
                    xtype: 'button',
                    id: 'saveRecordButton',
                    text: 'Speichern',                                  
                    align: 'right',
                    action: 'saveRecord',
                    hidden: true                
                }                                                 
            ]
        }
    }
});
