/* Local preview only. No production credentials or network client. Not included in build. */
(() => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('state') || 'demo';
  const cars = [
    ['Toyota','Alphard','2022','SC Package','AVAILABLE',289000,'Kuala Lumpur','DEMO-001',true],
    ['Toyota','Harrier','2023','Z Leather','AVAILABLE',218000,'Kota Bharu','DEMO-002',true],
    ['Honda','Stepwgn','2022','Spada','INCOMING',168000,'Kuala Lumpur','DEMO-003',false],
    ['Toyota','Vellfire','2021','ZG','BOOKED',259000,'Kota Bharu','DEMO-004',false],
    ['Lexus','RX300','2021','F Sport','PORT KLANG',278000,'Port Klang','DEMO-005',false],
    ['Toyota','Noah','2022','S-Z','AVAILABLE',179000,'Kuala Lumpur','',false]
  ].map(([brand,model,year,grade,status,price,location,chassis_no,is_featured],i) => ({id:i+1,brand,model,year,grade,status,price,location,chassis_no,is_featured,is_active:true,units:1,mileage:22000+i*3100,type:'MPV',updated_at:new Date().toISOString(),gallery_urls:[],image_url:'',variant:'Demo stock'}));
  const fixtures = {
    inventory: cars,
    site_settings: {id:1,company_name:'Izuwan Automobile Sdn Bhd',pricelist_date:'05.10.2026',processing_fee:0,registration_fee:0,default_interest:3.2,default_dsr:60,whatsapp_number:'',logo_url:'assets/company-logo.png',promotion_banner:''},
    salesmen: [{id:1,name:'Demo Advisor A',role:'Sales Advisor',branch:'Kuala Lumpur',whatsapp:'Demo only',is_active:true},{id:2,name:'Demo Advisor B',role:'Sales Advisor',branch:'Kota Bharu',whatsapp:'Demo only',is_active:true},{id:3,name:'Demo Advisor C',role:'Sales Advisor',branch:'Kuala Lumpur',whatsapp:'Demo only',is_active:false}],
    site_events: [{id:1,title:'October showroom weekend',subtitle:'Demo campaign · Explore selected reconditioned models.',start_date:'2026-10-01',end_date:'2026-10-31',location:'Kuala Lumpur & Kota Bharu',cta_label:'Lihat pilihan stok',is_active:true},{id:2,title:'Year-end preview',subtitle:'Demo campaign · Coming soon',start_date:'2026-12-01',end_date:'2026-12-15',is_active:true}],
    deliveries: [{id:1,title:'Delivered by Izuwan',customer_name:'Demo customer',model:'Toyota Alphard',location:'Kuala Lumpur',delivered_at:'2026-10-03',is_active:true},{id:2,title:'A new chapter',customer_name:'Demo customer',model:'Toyota Harrier',location:'Kota Bharu',delivered_at:'2026-10-02',is_active:true}],
    lead_events: ['whatsapp_click','car_detail','calculator','whatsapp_click','find_car','car_detail','event_click','whatsapp_click'].map((action,i) => ({id:i+1,action,page:i%2?'inventory':'home',label:i%2?'Toyota Alphard':'Toyota Harrier',created_at:new Date(Date.now()-i*3600000).toISOString(),source_url:''})),
    admin_users: {user_id:'local-demo'}
  };
  let signedIn = mode !== 'login' && mode !== 'denied';
  const blocked = {data:null,error:{message:'Preview sahaja — simpan, upload dan delete disekat.'}};
  const client = {
    from(table) {
      let write = false;
      const query = {
        select(){return query},order(){return query},eq(){return query},in(){return query},limit(){return query},maybeSingle(){return query},single(){return query},
        insert(){write=true;return query},upsert(){write=true;return query},update(){write=true;return query},delete(){write=true;return query},
        then(resolve,reject){
          return new Promise(done => setTimeout(() => {
            if(write) return done(blocked);
            if(mode==='error' && table!=='admin_users' || mode==='settings-error' && table==='site_settings') return done({data:null,error:{message:'Simulated unavailable source'}});
            if(table==='admin_users' && mode==='denied') return done({data:null,error:null});
            done({data: mode==='empty' && Array.isArray(fixtures[table])?[]:fixtures[table],error:null});
          },mode==='slow'?1500:80)).then(resolve,reject);
        }
      };return query;
    },
    auth:{getUser:async()=>({data:{user:signedIn?{id:'local-demo'}:null}}),signInWithPassword:async()=>{signedIn=true;return {error:null}},signOut:async()=>{signedIn=false;return {error:null}}},
    storage:{from:()=>({upload:async()=>blocked,remove:async()=>blocked,getPublicUrl:()=>({data:{publicUrl:''}})})}
  };
  window.IASBData = {client};
  window.IASB_PREVIEW = true;
  const banner=document.createElement('div');banner.className='preview-banner';banner.innerHTML='LOCAL PREVIEW · Demo data only · All writes blocked <a href="?state=demo">Demo</a><a href="?state=empty">Empty</a><a href="?state=error">Unavailable</a><a href="?state=settings-error#settings">Settings error</a><a href="?state=login">Login</a>';
  document.body.prepend(banner);
})();
