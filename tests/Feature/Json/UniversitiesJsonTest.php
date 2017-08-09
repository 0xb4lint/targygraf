<?php

namespace Tests\Feature\Json;

class UniversitiesJsonTest extends AbstractJsonTest
{
    protected $directory = 'json/universities';

    protected function checkJsonStructure($path)
    {
        $data = json_decode(file_get_contents(base_path($path)));

        $this->assertTrue(
            is_string($data->name),
            $path.' name is_string'
        );

        $this->assertTrue(
            is_int($data->row),
            $path.' row is_int'
        );

        $this->assertGreaterThanOrEqual(
            0,
            $data->row,
            $path.' row'
        );

        $this->assertTrue(
            is_int($data->ordering),
            $path.' ordering is_int'
        );

        $this->assertGreaterThanOrEqual(
            0,
            $data->ordering,
            $path.' ordering'
        );

        $this->assertTrue(
            is_bool($data->has_logo),
            $path.' has_logo is_bool'
        );
    }
}
