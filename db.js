const  mysql = require('mysql2');
const pool =mysql.createPool({
    host: 'localhost',
    user: 'root',
    password:'2006//pello',
    database:'tournament',
    waitForConnections:true,
    connectionLimit:10,
    queueLimit:0
});
const db =pool.promise();
module.exports =db;