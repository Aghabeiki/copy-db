const MongoClient = require('mongodb').MongoClient;

const listDatabases = async (port) => {
    const URI = `mongodb://127.0.0.1:${port}`;
    const client = await MongoClient.connect(URI, {useNewUrlParser: true});
    // const localDB = localCLient.db(dbName);
    const admin = client.db('admin');
    const {databases} = await admin.admin().listDatabases();
    return {databases: databases.filter(db => db.name !== 'admin' && db.empty === false).map(db => db.name), client};
};
const listCollections = async (remoteDB, localDB) => {
    const remoteCollectionsName = await remoteDB.listCollections().toArray();
    const localCollectionsName = await localDB.listCollections().toArray();

    return {
        remoteCollectionsName: remoteCollectionsName.map(collection => collection.name),
        localCollectionsName: localCollectionsName.map(collation => collation.name)
    };
};
module.exports = {listDatabases, listCollections};
