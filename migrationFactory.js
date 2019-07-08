const inquirer = require('inquirer');
const es = require('event-stream');
const ProgressBar = require('progress');

function migrationFactory({queryFilter, remoteCollection, localCollection, transformerFunction}) {
    let bar1 = null;
    return new Promise((resolve, reject) => {
        let count = 0;

        async function init() {
            const total = await remoteCollection
                .find(queryFilter || {}).count();

            const remoteStream = await remoteCollection
                .find(queryFilter || {})
                .stream()
            remoteStream.pause();
            return {remoteStream: remoteStream, total}
        }

        init()
            .then(({remoteStream, total}) => {
                inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirmed',
                        message: `We read total of ${total} objects to migrate to your target,Do you let me to continue?`
                    }
                ])
                    .then(({confirmed}) => {
                        if (confirmed) {
                            bar1 = new ProgressBar('Transfer [:bar] :percent :current/:total Rate :rate Elapsed :elapseds ', {
                                width: 20,
                                incomplete: ' ',
                                total,
                                curr: 0
                            });
                            bar1.tick(1);
                            remoteStream
                                .pipe(es.map((data, next) => {
                                    count++;
                                    next(null, transformerFunction(data));
                                }))
                                .pipe(es.map((doc, cb) => {
                                    function next() {
                                        bar1.tick(1)
                                        remoteStream.resume();
                                        cb();
                                    }

                                    remoteStream.pause();
                                    localCollection.insertOne(doc)
                                        .catch(err => {
                                            console.error(err);
                                        })
                                        .finally(_ => {
                                            next(null, {});
                                        })
                                }));
                            remoteStream.on('end', () => {
                                bar1.terminate();
                                resolve();
                            });
                            remoteStream.on('error', err => {
                                bar1.terminate();
                                reject(err);
                            });
                        } else {
                            console.info('migration skipped.');
                            process.exit(0);
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        process.exit(1);
                    })
            })
    });
};
module.exports = {migrationFactory};
