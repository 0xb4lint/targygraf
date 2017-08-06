<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateCourseBlocksTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('course_blocks', function (Blueprint $table) {
            $table->increments('id');

            $table->integer('program_id')->unsigned();
            $table->foreign('program_id')->references('id')->on('programs');

            $table->string('name');
            $table->boolean('is_semester')->default(true);
            $table->tinyInteger('ordering')->unsigned()->default(0);
            $table->boolean('is_counted')->default(true);

            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('course_blocks');
    }
}
