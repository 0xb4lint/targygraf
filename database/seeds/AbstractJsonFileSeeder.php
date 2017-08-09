<?php

use Illuminate\Database\Seeder;

abstract class AbstractJsonFileSeeder extends Seeder
{
    protected $jsonFilesDirectory;

    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $this->processAllJsonFiles();
    }

    protected function processAllJsonFiles()
    {
        $jsonFiles = scandir(base_path($this->jsonFilesDirectory));

        foreach ($jsonFiles as $jsonFile) {
            if (! ends_with($jsonFile, '.json')) {
                continue;
            }

            $this->processJsonFile(base_path($this->jsonFilesDirectory.'/'.$jsonFile));
        }
    }

    protected function processJsonFile($path)
    {
        $this->processData($path, json_decode(file_get_contents($path)));
    }

    abstract protected function processData($path, stdClass $data);
}
