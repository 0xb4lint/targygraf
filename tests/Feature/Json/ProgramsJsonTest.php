<?php

namespace Tests\Feature\Json;

class ProgramsJsonTest extends AbstractJsonTest
{
    protected $directory = 'json/programs';
    protected $facultiesDirectory = 'json/faculties';

    public function testFacultyExists()
    {
        $files = scandir(base_path($this->directory));

        foreach ($files as $file) {
            if ($file[0] == '.') {
                continue;
            }

            $fileParts = explode('_', pathinfo($file, PATHINFO_FILENAME));
            $facultyFilePath = $this->facultiesDirectory.'/'.$fileParts[0].'_'.$fileParts[1].'.json';

            $this->assertTrue(file_exists(base_path($facultyFilePath)), $file);
        }
    }

    protected function checkJsonStructure($path)
    {
        $data = json_decode(file_get_contents(base_path($path)));

        $this->assertTrue(
            is_string($data->name),
            $path.' name is_string'
        );

        $this->assertTrue(
            is_string($data->description),
            $path.' description is_string'
        );

        $this->assertTrue(
            is_null($data->curriculum_updated_at) ||
            is_string($data->curriculum_updated_at) && \DateTime::createFromFormat('Y-m-d', $data->curriculum_updated_at) !== false,
            $path.' curriculum_updated_at is_null || is_string && date'
        );

        $this->assertTrue(
            is_array($data->course_blocks),
            $path.' course_blocks is_array'
        );

        foreach ($data->course_blocks as $courseBlock) {
            $this->checkCourseBlockJsonStructure($path, $courseBlock);
        }
    }

    protected function checkCourseBlockJsonStructure($path, $courseBlock)
    {
        $this->assertTrue(
            is_string($courseBlock->name),
            $path.' name is_string - '.json_encode($courseBlock, JSON_UNESCAPED_UNICODE)
        );

        $this->assertTrue(
            is_int($courseBlock->row),
            $path.' row is_int - '.json_encode($courseBlock, JSON_UNESCAPED_UNICODE)
        );

        $this->assertGreaterThanOrEqual(
            0,
            $courseBlock->row,
            $path.' row - '.json_encode($courseBlock, JSON_UNESCAPED_UNICODE)
        );

        $this->assertTrue(
            is_array($courseBlock->courses),
            $path.' courses is_array - '.json_encode($courseBlock, JSON_UNESCAPED_UNICODE)
        );

        foreach ($courseBlock->courses as $course) {
            $this->checkCourseJsonStructure($path, $course);
        }
    }

    protected function checkCourseJsonStructure($path, $course)
    {
        $this->assertTrue(
            is_string($course->name) || $course->code == '______',
            $path.' name is_string || code(______) - '.json_encode($course, JSON_UNESCAPED_UNICODE)
        );

        $this->assertTrue(
            is_string($course->code) ||
            isset($course->course_block_references) && is_array($course->course_block_references),
            $path.' code is_string || is_array(course_block_references) - '.json_encode($course, JSON_UNESCAPED_UNICODE)
        );

        $this->assertTrue(
            is_int($course->credits),
            $path.' credits is_int - '.json_encode($course, JSON_UNESCAPED_UNICODE)
        );

        $this->assertGreaterThanOrEqual(
            0,
            $course->credits,
            $path.' credits - '.json_encode($course, JSON_UNESCAPED_UNICODE)
        );
    }
}
