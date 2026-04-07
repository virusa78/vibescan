import('redis').then(m => {
  console.log('Module keys:', Object.keys(m));
  console.log('createClient:', m.createClient);
  console.log('default:', m.default);
  console.log('default.createClient:', m.default?.createClient);
})
